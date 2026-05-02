import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  UpdateSettingsBody,
  GetSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const SETTINGS_ID = 1;

async function ensureSettings() {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));
  if (row) return row;

  const [created] = await db
    .insert(settingsTable)
    .values({ id: SETTINGS_ID, businessName: "Duka POS", logoUrl: null })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [again] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));
  return again!;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const row = await ensureSettings();
  res.json(
    GetSettingsResponse.parse({
      businessName: row.businessName,
      logoUrl: row.logoUrl,
    }),
  );
});

router.patch(
  "/settings",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await ensureSettings();

    const updates: Record<string, unknown> = {};
    if (parsed.data.businessName !== undefined) {
      updates["businessName"] = parsed.data.businessName.trim();
    }
    if (parsed.data.logoUrl !== undefined) {
      updates["logoUrl"] = parsed.data.logoUrl;
    }

    const [updated] =
      Object.keys(updates).length > 0
        ? await db
            .update(settingsTable)
            .set(updates)
            .where(eq(settingsTable.id, SETTINGS_ID))
            .returning()
        : await db
            .select()
            .from(settingsTable)
            .where(eq(settingsTable.id, SETTINGS_ID));

    res.json(
      GetSettingsResponse.parse({
        businessName: updated!.businessName,
        logoUrl: updated!.logoUrl,
      }),
    );
  },
);

export default router;
