import { Router, type IRouter } from "express";
import { eq, ilike, or, asc } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  CreateProductBody,
  GetProductParams,
  GetProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    priceCents: p.priceCents,
    stock: p.stock,
    category: p.category,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.trim();

  const rows = search
    ? await db
        .select()
        .from(productsTable)
        .where(
          or(
            ilike(productsTable.name, `%${search}%`),
            ilike(productsTable.sku, `%${search}%`),
            ilike(productsTable.category, `%${search}%`),
          ),
        )
        .orderBy(asc(productsTable.name))
    : await db.select().from(productsTable).orderBy(asc(productsTable.name));

  res.json(ListProductsResponse.parse(rows.map(serialize)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(productsTable)
    .values({
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      description: parsed.data.description ?? null,
      priceCents: parsed.data.priceCents,
      stock: parsed.data.stock,
      category: parsed.data.category ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to insert product" });
    return;
  }

  res.status(201).json(GetProductResponse.parse(serialize(row)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(serialize(row)));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }

  if (Object.keys(updates).length === 0) {
    const [row] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(UpdateProductResponse.parse(serialize(row)));
    return;
  }

  const [row] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(UpdateProductResponse.parse(serialize(row)));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
