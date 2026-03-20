import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/auth/login?returnTo=/admin");
  }

  const userRoles: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];

  if (!userRoles.includes("admin")) {
    redirect("/");
  }

  const user = session.user;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg text-gray-900">
            YASS
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{user.name ?? user.email}</span>
          <Link
            href="/auth/logout"
            className="text-gray-500 hover:text-gray-900 underline"
          >
            Sign out
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 border-r bg-gray-50 p-4 flex flex-col gap-1">
          <Link
            href="/admin/events"
            className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Events
          </Link>
          <Link
            href="/admin/users"
            className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Users
          </Link>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
