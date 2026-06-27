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
import {
  ApiClientError,
  getValidationDetails,
} from "@/lib/api";

type AuthField = "name" | "email" | "password";

type FieldErrors = Partial<Record<AuthField, string[]>>;

const passwordRequirements = [
  "At least 8 characters",
  "At least 1 uppercase letter",
  "At least 1 lowercase letter",
  "At least 1 number",
];

function normalizeMessage(field: AuthField, message: string): string {
  if (field === "name") {
    if (message.includes(">=2 characters")) {
      return "Full name must be at least 2 characters.";
    }
  }

  if (field === "email") {
    if (message === "Invalid email address") {
      return "Please enter a valid email address.";
    }
  }

  if (field === "password") {
    if (message.includes(">=8 characters")) {
      return "Password must be at least 8 characters.";
    }

    if (message.includes(">=1 characters")) {
      return "Password is required.";
    }

    if (message === "Password needs an uppercase letter") {
      return "Password must include at least 1 uppercase letter.";
    }

    if (message === "Password needs a lowercase letter") {
      return "Password must include at least 1 lowercase letter.";
    }

    if (message === "Password needs a number") {
      return "Password must include at least 1 number.";
    }
  }

  if (field === "name") return `Full name: ${message}`;
  if (field === "email") return `Email: ${message}`;
  return `Password: ${message}`;
}

function addFieldError(
  errors: FieldErrors,
  field: AuthField,
  message: string,
): FieldErrors {
  const next = errors[field] ?? [];

  if (next.includes(message)) {
    return errors;
  }

  return {
    ...errors,
    [field]: [...next, message],
  };
}

function validateRegisterForm(
  name: string,
  email: string,
  password: string,
): FieldErrors {
  let errors: FieldErrors = {};

  if (!name.trim()) {
    errors = addFieldError(errors, "name", "Full name is required.");
  } else if (name.trim().length < 2) {
    errors = addFieldError(errors, "name", "Full name must be at least 2 characters.");
  }

  if (!email.trim()) {
    errors = addFieldError(errors, "email", "Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors = addFieldError(errors, "email", "Please enter a valid email address.");
  }

  if (!password) {
    errors = addFieldError(errors, "password", "Password is required.");
  } else {
    if (password.length < 8) {
      errors = addFieldError(errors, "password", "Password must be at least 8 characters.");
    }
    if (!/[A-Z]/.test(password)) {
      errors = addFieldError(errors, "password", "Password must include at least 1 uppercase letter.");
    }
    if (!/[a-z]/.test(password)) {
      errors = addFieldError(errors, "password", "Password must include at least 1 lowercase letter.");
    }
    if (!/[0-9]/.test(password)) {
      errors = addFieldError(errors, "password", "Password must include at least 1 number.");
    }
  }

  return errors;
}

function validateLoginForm(
  email: string,
  password: string,
): FieldErrors {
  let errors: FieldErrors = {};

  if (!email.trim()) {
    errors = addFieldError(errors, "email", "Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors = addFieldError(errors, "email", "Please enter a valid email address.");
  }

  if (!password) {
    errors = addFieldError(errors, "password", "Password is required.");
  }

  return errors;
}

function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((messages) => (messages?.length ?? 0) > 0);
}

function mapApiErrors(error: ApiClientError): FieldErrors {
  return getValidationDetails(error).reduce<FieldErrors>((errors, detail) => {
    const field = detail.path.replace(/^body\./, "");

    if (field !== "name" && field !== "email" && field !== "password") {
      return errors;
    }

    return addFieldError(errors, field, normalizeMessage(field, detail.message));
  }, {});
}

function FieldErrorList({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {errors.map((message) => (
        <p key={message} className="text-sm text-rose-700">
          {message}
        </p>
      ))}
    </div>
  );
}

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isRegister = mode === "register";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const clientErrors = isRegister
      ? validateRegisterForm(name, email, password)
      : validateLoginForm(email, password);

    if (hasFieldErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      router.replace("/dashboard");
    } catch (reason) {
      if (reason instanceof ApiClientError) {
        const nextFieldErrors = mapApiErrors(reason);

        if (hasFieldErrors(nextFieldErrors)) {
          setFieldErrors(nextFieldErrors);
        } else {
          setError(reason.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
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
              {isRegister && <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mahesh Ray" required aria-invalid={fieldErrors.name?.length ? true : undefined} className={fieldErrors.name?.length ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : undefined} /><FieldErrorList errors={fieldErrors.name} /></div>}
              <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required aria-invalid={fieldErrors.email?.length ? true : undefined} className={fieldErrors.email?.length ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : undefined} /><FieldErrorList errors={fieldErrors.email} /></div>
              <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" minLength={8} required aria-invalid={fieldErrors.password?.length ? true : undefined} className={fieldErrors.password?.length ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : undefined} /><FieldErrorList errors={fieldErrors.password} />{isRegister && <div className="mt-2 text-xs leading-5 text-slate-500">{passwordRequirements.join(" • ")}</div>}</div>
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
