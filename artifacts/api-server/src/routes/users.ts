import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const rows = await db
    .select({ id: usersTable.id, username: usersTable.username, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(rows.map((u) => ({ id: u.id, username: u.username, createdAt: u.createdAt.toISOString() })));
});

const CreateUserBody = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()));

  if (existing) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(usersTable)
    .values({ username: username.trim(), passwordHash })
    .returning({ id: usersTable.id, username: usersTable.username, createdAt: usersTable.createdAt });

  if (!created) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  req.log.info({ username: created.username }, "New user created");
  res.status(201).json({ id: created.id, username: created.username, createdAt: created.createdAt.toISOString() });
});

const ResetPasswordBody = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

router.patch("/users/:id/password", async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, targetId));

  req.log.info({ targetId }, "Admin reset user password");
  res.json({ ok: true });
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (targetId === req.session.userId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  req.log.info({ targetId }, "User deleted");
  res.sendStatus(204);
});

export default router;
