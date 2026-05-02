import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const DailyReportQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

router.get("/reports/daily", async (req, res): Promise<void> => {
  const parsed = DailyReportQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid query" });
    return;
  }

  const dateStr =
    parsed.data.date ??
    new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

  const dayStart = new Date(`${dateStr}T00:00:00+03:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999+03:00`);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "paid"),
        gte(ordersTable.createdAt, dayStart),
        lt(ordersTable.createdAt, dayEnd),
      ),
    )
    .orderBy(ordersTable.createdAt);

  const orderIds = orders.map((o) => o.id);

  const items =
    orderIds.length > 0
      ? await db
          .select()
          .from(orderItemsTable)
          .where(sql`${orderItemsTable.orderId} = ANY(${sql.raw(`ARRAY[${orderIds.join(",")}]::int[]`)})`)
      : [];

  const itemsByOrder = new Map<number, typeof items>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  let totalCents = 0;
  let cashCents = 0;
  let mpesaCents = 0;
  let cashCount = 0;
  let mpesaCount = 0;

  const serialized = orders.map((o) => {
    totalCents += o.totalCents;
    if (o.paymentMethod === "cash") {
      cashCents += o.totalCents;
      cashCount++;
    } else {
      mpesaCents += o.totalCents;
      mpesaCount++;
    }
    return {
      id: o.id,
      reference: o.reference,
      paymentMethod: o.paymentMethod,
      cashierName: o.cashierName,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
      items: (itemsByOrder.get(o.id) ?? []).map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        lineTotalCents: it.lineTotalCents,
      })),
    };
  });

  res.json({
    date: dateStr,
    summary: {
      totalCents,
      cashCents,
      mpesaCents,
      cashCount,
      mpesaCount,
      orderCount: orders.length,
    },
    orders: serialized,
  });
});

export default router;
