"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ApiClientError } from "@/lib/api";

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <div className="hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <Logo />
        <div className="my-auto max-w-xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-sky-400">Requirement intelligence</p><h1 className="mt-5 font-[var(--font-manrope)] text-5xl font-bold leading-tight tracking-tight">Turn unclear ideas into a clear engineering plan.</h1><p className="mt-5 text-lg leading-8 text-slate-300">Analyze requirements, generate tasks and plan sprints from one focused workspace.</p></div>
        <p className="text-sm text-slate-500">SpecForge AI MVP</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <Card className="p-6 sm:p-8">
            <h2 className="font-[var(--font-manrope)] text-2xl font-bold tracking-tight">{isRegister ? "Create your workspace" : "Welcome back"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{isRegister ? "Start turning client requirements into development-ready work." : "Continue planning your next software project."}</p>
            <form className="mt-7 space-y-4" onSubmit={submit}>
              {isRegister && <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mahesh Ray" required /></div>}
              <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div>
              <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" minLength={8} required /></div>
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</div>}
              <Button className="w-full" size="lg" disabled={submitting}>{submitting ? <><Spinner /> Please wait</> : <>{isRegister ? "Create account" : "Log in"}<ArrowRight className="h-4 w-4" /></>}</Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">{isRegister ? "Already have an account?" : "New to SpecForge?"} <Link className="font-semibold text-slate-950 hover:underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create account"}</Link></p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
