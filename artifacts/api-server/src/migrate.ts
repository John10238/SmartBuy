import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";

const DDL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id"            serial PRIMARY KEY,
  "username"      text   NOT NULL UNIQUE,
  "password_hash" text   NOT NULL,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id"            integer PRIMARY KEY NOT NULL,
  "business_name" text    NOT NULL DEFAULT 'SmartBuy',
  "logo_url"      text,
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "products" (
  "id"          serial  PRIMARY KEY,
  "name"        text    NOT NULL,
  "sku"         text,
  "description" text,
  "price_cents" integer NOT NULL,
  "stock"       integer NOT NULL DEFAULT 0,
  "category"    text,
  "image_url"   text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id"             serial  PRIMARY KEY,
  "reference"      text    NOT NULL UNIQUE,
  "status"         text    NOT NULL DEFAULT 'pending',
  "total_cents"    integer NOT NULL,
  "customer_phone" text,
  "customer_name"  text,
  "cashier_name"   text,
  "payment_method" text    NOT NULL DEFAULT 'mpesa',
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "order_items" (
  "id"              serial  PRIMARY KEY,
  "order_id"        integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id"      integer NOT NULL REFERENCES "products"("id"),
  "product_name"    text    NOT NULL,
  "quantity"        integer NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "line_total_cents" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id"                        serial  PRIMARY KEY,
  "order_id"                  integer REFERENCES "orders"("id") ON DELETE SET NULL,
  "amount_cents"              integer NOT NULL,
  "provider"                  text    NOT NULL DEFAULT 'mpesa',
  "status"                    text    NOT NULL DEFAULT 'pending',
  "mpesa_checkout_request_id" text,
  "mpesa_merchant_request_id" text,
  "mpesa_receipt_number"      text,
  "phone_number"              text,
  "raw_callback"              text,
  "created_at"                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid"    varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess"   json    NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
`;

export async function runMigrations(): Promise<void> {
  logger.info("Running database migrations…");
  const client = await pool.connect();
  try {
    await client.query(DDL);

    await client.query(
      `INSERT INTO settings (id, business_name) VALUES (1, 'SmartBuy') ON CONFLICT (id) DO NOTHING`,
    );

    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users",
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    if (count === 0) {
      const hash = await bcrypt.hash("admin", 10);
      await client.query(
        `INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`,
        ["admin", hash],
      );
      logger.info(
        "Seeded default admin user — username: admin, password: admin. Change it from Settings.",
      );
    }

    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}
