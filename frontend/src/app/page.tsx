"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// The home page just sends people to the right place
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else router.replace(user.role === "vendor" ? "/vendor" : "/dashboard");
  }, [user, loading, router]);

  return <p className="p-8 text-gray-500">Loading...</p>;
}