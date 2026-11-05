"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { btnCls, cardCls, inputCls, labelCls } from "@/lib/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"user" | "vendor">("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await register({
        name,
        email,
        password,
        role,
        ...(role === "vendor" ? { businessName, city } : {}),
      });
      router.push(user.role === "vendor" ? "/vendor" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto mt-12 max-w-md px-4">
      <div className={cardCls}>
        <h1 className="mb-4 text-2xl font-bold">Create an account</h1>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["user", "vendor"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded border px-3 py-2 text-sm ${
                role === r
                  ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-700"
                  : "border-gray-300"
              }`}
            >
              {r === "user" ? "I am planning an event" : "I am a vendor"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input
              required
              minLength={2}
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
            <label className={labelCls}>Password (at least 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {role === "vendor" && (
            <>
              <div>
                <label className={labelCls}>Business name</label>
                <input
                  required
                  minLength={2}
                  className={inputCls}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input
                  required
                  minLength={2}
                  className={inputCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className={btnCls + " w-full"}>
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          Already registered?{" "}
          <Link href="/login" className="text-indigo-600 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}