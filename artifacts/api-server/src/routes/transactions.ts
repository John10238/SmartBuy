import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, transactionsTable, ordersTable } from "@workspace/db";
import { ListTransactionsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/transactions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      tx: transactionsTable,
      orderRef: ordersTable.reference,
    })
    .from(transactionsTable)
    .leftJoin(ordersTable, eq(transactionsTable.orderId, ordersTable.id))
    .orderBy(desc(transactionsTable.createdAt));

  const serialized = rows.map(({ tx, orderRef }) => ({
    id: tx.id,
    orderId: tx.orderId,
    orderReference: orderRef,
    amountCents: tx.amountCents,
    provider: tx.provider as "mpesa" | "cash",
    status: tx.status as "pending" | "success" | "failed",
    mpesaCheckoutRequestId: tx.mpesaCheckoutRequestId,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    phoneNumber: tx.phoneNumber,
    rawCallback: tx.rawCallback,
    createdAt: tx.createdAt.toISOString(),
  }));

  res.json(ListTransactionsResponse.parse(serialized));
});

export default router;
