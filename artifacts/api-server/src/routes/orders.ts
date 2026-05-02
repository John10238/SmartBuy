import { Router, type IRouter } from "express";
import { eq, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
} from "@workspace/db";
import {
  ListOrdersQueryParams,
  ListOrdersResponse,
  CreateOrderBody,
  GetOrderParams,
  GetOrderResponse,
  CancelOrderParams,
  DeleteOrderParams,
} from "@workspace/api-zod";
import { generateOrderReference } from "../lib/mpesa";

const router: IRouter = Router();

type OrderRow = typeof ordersTable.$inferSelect;
type OrderItemRow = typeof orderItemsTable.$inferSelect;

function serializeOrder(order: OrderRow, items: OrderItemRow[]) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status as "pending" | "paid" | "cancelled" | "failed",
    totalCents: order.totalCents,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    cashierName: order.cashierName,
    paymentMethod: order.paymentMethod as "mpesa" | "cash",
    items: items.map((it) => ({
      id: it.id,
      orderId: it.orderId,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orders = parsed.data.status
    ? await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.status, parsed.data.status))
        .orderBy(desc(ordersTable.createdAt))
    : await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.createdAt));

  if (orders.length === 0) {
    res.json(ListOrdersResponse.parse([]));
    return;
  }

  const ids = orders.map((o) => o.id);
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, ids));

  const grouped = new Map<number, OrderItemRow[]>();
  for (const it of items) {
    const list = grouped.get(it.orderId) ?? [];
    list.push(it);
    grouped.set(it.orderId, list);
  }

  res.json(
    ListOrdersResponse.parse(
      orders.map((o) => serializeOrder(o, grouped.get(o.id) ?? [])),
    ),
  );
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of parsed.data.items) {
    const p = productMap.get(item.productId);
    if (!p) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    if (p.stock < item.quantity) {
      res
        .status(400)
        .json({ error: `Insufficient stock for ${p.name} (have ${p.stock})` });
      return;
    }
  }

  const totalCents = parsed.data.items.reduce((sum, item) => {
    const p = productMap.get(item.productId)!;
    return sum + p.priceCents * item.quantity;
  }, 0);

  const reference = generateOrderReference();
  const isCash = parsed.data.paymentMethod === "cash";
  const initialStatus = isCash ? "paid" : "pending";

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(ordersTable)
        .values({
          reference,
          status: initialStatus,
          totalCents,
          customerPhone: parsed.data.customerPhone ?? null,
          customerName: parsed.data.customerName ?? null,
          cashierName: parsed.data.cashierName?.trim() || null,
          paymentMethod: parsed.data.paymentMethod,
        })
        .returning();

      if (!order) {
        throw new Error("Failed to create order");
      }

      const itemsToInsert = parsed.data.items.map((item) => {
        const p = productMap.get(item.productId)!;
        return {
          orderId: order.id,
          productId: p.id,
          productName: p.name,
          quantity: item.quantity,
          unitPriceCents: p.priceCents,
          lineTotalCents: p.priceCents * item.quantity,
        };
      });

      const insertedItems = await tx
        .insert(orderItemsTable)
        .values(itemsToInsert)
        .returning();

      if (isCash) {
        for (const item of parsed.data.items) {
          await tx
            .update(productsTable)
            .set({
              stock: sql`${productsTable.stock} - ${item.quantity}`,
            })
            .where(eq(productsTable.id, item.productId));
        }
      }

      return { order, items: insertedItems };
    });

    res
      .status(201)
      .json(GetOrderResponse.parse(serializeOrder(result.order, result.items)));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.post("/orders/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, params.data.id));

      if (!order) return { kind: "not-found" as const };
      if (order.status === "cancelled") {
        const items = await tx
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));
        return { kind: "ok" as const, order, items };
      }

      if (order.status === "paid") {
        const items = await tx
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));
        for (const item of items) {
          await tx
            .update(productsTable)
            .set({
              stock: sql`${productsTable.stock} + ${item.quantity}`,
            })
            .where(eq(productsTable.id, item.productId));
        }
      }

      const [updated] = await tx
        .update(ordersTable)
        .set({ status: "cancelled" })
        .where(eq(ordersTable.id, order.id))
        .returning();

      const items = await tx
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      return { kind: "ok" as const, order: updated!, items };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json(GetOrderResponse.parse(serializeOrder(result.order, result.items)));
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, params.data.id));

      if (!order) return { kind: "not-found" as const };

      if (order.status === "paid") {
        const items = await tx
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));
        for (const item of items) {
          await tx
            .update(productsTable)
            .set({
              stock: sql`${productsTable.stock} + ${item.quantity}`,
            })
            .where(eq(productsTable.id, item.productId));
        }
      }

      await tx.delete(ordersTable).where(eq(ordersTable.id, order.id));
      return { kind: "ok" as const };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Failed to delete order");
    res.status(500).json({ error: "Failed to delete order" });
  }
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json(GetOrderResponse.parse(serializeOrder(order, items)));
});

export default router;
