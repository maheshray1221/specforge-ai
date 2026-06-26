"use client";

import { ArrowUpRight, CalendarDays, ListTodo, ScrollText } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Project } from "@/lib/types";

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}>
      <Link href={`/dashboard/projects/${project.id}`}>
        <Card className="group h-full p-5 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg hover:shadow-slate-200/50">
          <div className="flex items-start justify-between gap-3"><div><Badge>{project.key}</Badge><h3 className="mt-4 text-lg font-semibold tracking-tight">{project.name}</h3></div><span className="rounded-xl bg-slate-50 p-2 text-slate-400 transition group-hover:bg-sky-50 group-hover:text-sky-600"><ArrowUpRight className="h-4 w-4" /></span></div>
          <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-slate-500">{project.description || "No project description yet."}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><ScrollText className="h-3.5 w-3.5" />{project._count.requirements}</span>
            <span className="flex items-center gap-1.5"><ListTodo className="h-3.5 w-3.5" />{project._count.tasks}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{project._count.sprints}</span>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
