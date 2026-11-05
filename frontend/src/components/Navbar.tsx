"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-600">
          EventPlanner
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href={user.role === "vendor" ? "/vendor" : "/dashboard"}>
                Dashboard
              </Link>
              <span className="text-gray-500">{user.name}</span>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="rounded border px-3 py-1 hover:bg-gray-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/register">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}