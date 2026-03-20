import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Find or create the YASS user record for an Auth0-authenticated organizer.
 *
 * Auth0 users are not automatically inserted into the `users` table on first
 * login. This helper upserts on first access so organizer API routes never
 * return "user not found" for a legitimately authenticated user.
 */
export async function getOrUpsertOrganizerUser(sessionUser: {
  email?: string | null;
  name?: string | null;
}): Promise<typeof users.$inferSelect | null> {
  if (!sessionUser.email) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, sessionUser.email),
  });
  if (existing) return existing;

  const name = sessionUser.name ?? sessionUser.email.split("@")[0];
  const [created] = await db
    .insert(users)
    .values({ email: sessionUser.email, name })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Race condition: another concurrent request inserted first
  return (await db.query.users.findFirst({ where: eq(users.email, sessionUser.email) })) ?? null;
}
