"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [backend, setBackend] = useState("loading...");
  const [dbTime, setDbTime] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        setBackend(data.status);
        setDbTime(data.dbTime);
      })
      .catch(() => setBackend("backend not reachable"));
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">Event Platform</h1>
      <p className="mt-4">Backend status: {backend}</p>
      <p>Database time: {dbTime}</p>
    </main>
  );
}