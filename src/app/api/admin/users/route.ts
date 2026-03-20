import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userRolesClaim: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];

  if (!userRolesClaim.includes("admin")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      role: userRoles.role,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .orderBy(users.createdAt);

  return NextResponse.json(allUsers);
}
