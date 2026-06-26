"use client";

import { FolderKanban, LogOut, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" /></div>;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center justify-between px-5"><Logo /><button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
      <nav className="px-3">
        <button onClick={() => { router.push("/dashboard"); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl bg-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-900">
          <FolderKanban className="h-4.5 w-4.5" /> Projects
        </button>
      </nav>
      <div className="mt-auto border-t border-slate-200 p-4">
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={async () => { await logout(); router.replace("/login"); }}><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-white" onClick={(event) => event.stopPropagation()}>{sidebar}</aside></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur lg:hidden"><button onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button><div className="ml-3"><Logo /></div></header>
      <main className="lg:pl-64"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div></main>
    </div>
  );
}
