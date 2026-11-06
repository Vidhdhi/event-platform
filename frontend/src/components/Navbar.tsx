"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="navbar">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 text-sm font-bold text-white">
            E
          </span>
          <span className="font-display text-lg font-bold">EventPlanner</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href={user.role === "vendor" ? "/vendor" : "/dashboard"}
                className="font-semibold hover:text-violet-700"
              >
                Dashboard
              </Link>
              <span
                title={user.name}
                className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700"
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="btn btn-ghost !px-3 !py-1.5"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold hover:text-violet-700">
                Log in
              </Link>
              <Link href="/register" className="btn !px-4 !py-1.5">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}