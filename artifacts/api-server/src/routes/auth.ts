import { Router, type IRouter } from "express";
import { eq, ne, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  LoginBody,
  UpdateCredentialsBody,
  GetCurrentUserResponse,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  requireAuth,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));
  if (!user) {
    req.session.destroy(() => undefined);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(
    GetCurrentUserResponse.parse({
      id: user.id,
      username: user.username,
    }),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username.trim()));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;
  req.session.save((saveErr) => {
    if (saveErr) {
      req.log.error({ err: saveErr }, "Failed to save session");
      res.status(500).json({ error: "Failed to log in" });
      return;
    }
    res.json(
      GetCurrentUserResponse.parse({
        id: user.id,
        username: user.username,
      }),
    );
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.clearCookie("duka.sid");
    res.sendStatus(204);
  });
});

router.patch(
  "/auth/credentials",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UpdateCredentialsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!parsed.data.newUsername && !parsed.data.newPassword) {
      res.status(400).json({
        error: "Provide a new username, a new password, or both.",
      });
      return;
    }

    const userId = req.session.userId!;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const ok = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.newUsername) {
      const newName = parsed.data.newUsername.trim();
      if (newName !== user.username) {
        const [conflict] = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.username, newName),
              ne(usersTable.id, userId),
            ),
          );
        if (conflict) {
          res.status(409).json({ error: "That username is already taken" });
          return;
        }
        updates["username"] = newName;
      }
    }
    if (parsed.data.newPassword) {
      updates["passwordHash"] = await hashPassword(parsed.data.newPassword);
    }

    if (Object.keys(updates).length === 0) {
      res.json(
        GetCurrentUserResponse.parse({
          id: user.id,
          username: user.username,
        }),
      );
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) {
      res.status(500).json({ error: "Failed to update credentials" });
      return;
    }

    res.json(
      GetCurrentUserResponse.parse({
        id: updated.id,
        username: updated.username,
      }),
    );
  },
);

export default router;
