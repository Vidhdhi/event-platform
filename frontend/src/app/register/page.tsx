"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";

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
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute."
    >
      <div className="seg mb-5">
        <button
          type="button"
          className="seg-btn"
          aria-pressed={role === "user"}
          onClick={() => setRole("user")}
        >
          I am planning an event
        </button>
        <button
          type="button"
          className="seg-btn"
          aria-pressed={role === "vendor"}
          onClick={() => setRole("vendor")}
        >
          I am a vendor
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input
            required
            minLength={2}
            autoComplete="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <PasswordField
          label="Password (at least 8 characters)"
          minLength={8}
          value={password}
          onChange={setPassword}
        />

        {role === "vendor" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Business name</label>
              <input
                required
                minLength={2}
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                required
                minLength={2}
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn w-full">
          {submitting && <span className="spinner" />}
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="muted mt-5 text-sm">
        Already registered?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}