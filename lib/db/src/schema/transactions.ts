import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id, {
    onDelete: "set null",
  }),
  amountCents: integer("amount_cents").notNull(),
  provider: text("provider").notNull().default("mpesa"),
  status: text("status").notNull().default("pending"),
  mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
  mpesaMerchantRequestId: text("mpesa_merchant_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  phoneNumber: text("phone_number"),
  rawCallback: text("raw_callback"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
export type InsertTransaction = typeof transactionsTable.$inferInsert;
