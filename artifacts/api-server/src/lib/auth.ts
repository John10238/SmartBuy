import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import type { RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const PgSessionStore = connectPgSimple(session);

const SESSION_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
`;

let sessionTableEnsured: Promise<void> | null = null;
async function ensureSessionTable(): Promise<void> {
  if (sessionTableEnsured) return sessionTableEnsured;
  sessionTableEnsured = pool.query(SESSION_TABLE_DDL).then(() => undefined);
  return sessionTableEnsured;
}

export function createSessionMiddleware(): RequestHandler {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for session store");
  }

  const isProd = process.env["NODE_ENV"] === "production";

  const store = new PgSessionStore({
    conString: databaseUrl,
    createTableIfMissing: false,
    tableName: "user_sessions",
  });

  void ensureSessionTable();

  return session({
    store,
    secret,
    name: "duka.sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};
