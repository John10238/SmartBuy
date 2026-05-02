import { db, usersTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

export async function ensureDefaultUser(): Promise<void> {
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length === 0) {
    const passwordHash = await hashPassword("admin");
    await db
      .insert(usersTable)
      .values({ username: "admin", passwordHash })
      .onConflictDoNothing();
    logger.info(
      "Seeded default user 'admin' with password 'admin'. Change it from Settings.",
    );
  }

  const settings = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1));
  if (settings.length === 0) {
    await db
      .insert(settingsTable)
      .values({ id: 1, businessName: "SmartBuy", logoUrl: null })
      .onConflictDoNothing();
  } else {
    const current = settings[0];
    if (current?.businessName === "Duka POS") {
      await db
        .update(settingsTable)
        .set({ businessName: "SmartBuy" })
        .where(eq(settingsTable.id, 1));
      logger.info("Updated business name from 'Duka POS' to 'SmartBuy'.");
    }
  }
}
