"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    await refreshUser().catch(() => setUser(data.user));
  }, [refreshUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    setUser(data.user);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await api<void>("/auth/logout", { method: "POST" }, false).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
