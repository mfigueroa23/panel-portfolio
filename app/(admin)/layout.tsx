import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NoticeProvider } from "@/components/content/notice-provider";
import { MobileNav } from "@/components/nav/mobile-nav";
import { PendingCountProvider } from "@/components/nav/pending-count-provider";
import { Sidebar } from "@/components/nav/sidebar";
import { SessionProvider } from "@/components/session/session-provider";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// proxy.ts already sends visitors without a live cookie to /login; the token
// is handed to the client provider so browser requests can carry it.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");

  return (
    <SessionProvider initialToken={token}>
      <NoticeProvider>
        <PendingCountProvider>
          <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileNav />
              <main className="min-w-0 flex-1">{children}</main>
            </div>
          </div>
        </PendingCountProvider>
      </NoticeProvider>
    </SessionProvider>
  );
}
