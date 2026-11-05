"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Wrap a page in <Protected> so only logged-in users (optionally of one role) can see it
export default function Protected({
  children,
  role,
}: {
  children: ReactNode;
  role?: "user" | "vendor";
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (role && user.role !== role) {
      router.replace(user.role === "vendor" ? "/vendor" : "/dashboard");
    }
  }, [user, loading, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return <p className="p-8 text-gray-500">Loading...</p>;
  }
  return <>{children}</>;
}