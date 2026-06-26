"use client";

import { motion } from "framer-motion";
import { ArrowRight, Braces, CheckCircle2, Database, ListChecks, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  { icon: Sparkles, title: "AI requirement analysis", text: "Clarification questions, user stories, acceptance criteria and risks." },
  { icon: Braces, title: "Technical blueprint", text: "APIs, database entities, frontend and backend planning in one place." },
  { icon: ListChecks, title: "Development-ready tasks", text: "Frontend, backend, QA and DevOps tasks with priority and story points." },
  { icon: Workflow, title: "Sprint planning", text: "Group generated tasks into focused sprints with capacity tracking." },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><Logo /><div className="flex items-center gap-2"><Link href="/login"><Button variant="ghost">Log in</Button></Link><Link href="/register"><Button>Start building <ArrowRight className="h-4 w-4" /></Button></Link></div></header>
      <main>
        <section className="relative border-y border-slate-100 bg-gradient-to-b from-sky-50/70 via-white to-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="soft-grid absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-sky-800 shadow-sm"><Sparkles className="h-4 w-4" /> AI-powered software planning</div>
              <h1 className="max-w-3xl font-[var(--font-manrope)] text-5xl font-bold leading-[1.04] tracking-[-.045em] sm:text-6xl lg:text-7xl">From client idea to <span className="text-sky-600">development-ready</span> plan.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">SpecForge AI converts raw requirements into user stories, APIs, database plans, engineering tasks and sprint-ready work in minutes.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/register"><Button size="lg" className="w-full sm:w-auto">Create your workspace <ArrowRight className="h-4 w-4" /></Button></Link><a href="#features"><Button size="lg" variant="outline" className="w-full sm:w-auto">Explore features</Button></a></div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">{["No setup complexity", "Groq-powered AI", "Clean project workflow"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{item}</span>)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6, delay: .12 }} className="relative">
              <div className="absolute -inset-8 rounded-[3rem] bg-sky-200/30 blur-3xl" />
              <Card className="relative overflow-hidden rounded-3xl border-slate-200/70 p-3 shadow-2xl shadow-slate-200/60">
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-slate-400">Requirement pipeline</p><h3 className="mt-1 text-lg font-semibold">E-commerce platform</h3></div><Database className="h-5 w-5 text-sky-400" /></div>
                  <div className="mt-6 space-y-3">{["Clarify business rules", "Generate 8 user stories", "Design 14 API endpoints", "Create 31 engineering tasks", "Plan Sprint 1"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3 py-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-xs font-semibold text-sky-300">{index + 1}</span><span className="text-sm text-slate-200">{item}</span><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" /></div>)}</div>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>
        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-sky-600">One connected workflow</p><h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight sm:text-4xl">Everything your team needs before coding starts.</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }, index) => <motion.div key={title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}><Card className="h-full p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-600"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></Card></motion.div>)}</div></section>
      </main>
      <footer className="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-500">SpecForge AI — Build better software before writing code.</footer>
    </div>
  );
}
