"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: "user" | "vendor" | "admin";
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: "user" | "vendor";
  businessName?: string;
  city?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load: if a token is saved, ask the backend who we are
  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api<User>("/auth/me"));
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  async function register(data: RegisterInput) {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      json: data,
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}