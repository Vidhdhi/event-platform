"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { btnCls, cardCls, inputCls, labelCls } from "@/lib/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(user.role === "vendor" ? "/vendor" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto mt-12 max-w-md px-4">
      <div className={cardCls}>
        <h1 className="mb-4 text-2xl font-bold">Log in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              required
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input
              type="password"
              required
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className={btnCls + " w-full"}>
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          No account?{" "}
          <Link href="/register" className="text-indigo-600 underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}