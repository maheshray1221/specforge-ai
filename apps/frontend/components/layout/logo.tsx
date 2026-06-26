import { Sparkles } from "lucide-react";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-semibold text-slate-950">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white shadow-sm"><Sparkles className="h-4.5 w-4.5" /></span>
      {!compact && <span className="text-lg tracking-tight">SpecForge AI</span>}
    </Link>
  );
}
