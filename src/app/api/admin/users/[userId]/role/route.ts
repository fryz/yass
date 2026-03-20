import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sessionRoles: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];

  if (!sessionRoles.includes("admin")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();
  const { role } = body as { role: "admin" | "organizer" | "user" };

  if (!["admin", "organizer", "user"].includes(role)) {
    return new NextResponse("Invalid role", { status: 400 });
  }

  // Verify the user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return new NextResponse("User not found", { status: 404 });
  }

  // Upsert into user_roles
  const existing = await db.query.userRoles.findFirst({
    where: eq(userRoles.userId, userId),
  });

  if (existing) {
    await db
      .update(userRoles)
      .set({ role })
      .where(eq(userRoles.userId, userId));
  } else {
    await db.insert(userRoles).values({ userId, role });
  }

  return NextResponse.json({ success: true, role });
}
