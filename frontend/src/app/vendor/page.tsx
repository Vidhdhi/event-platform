"use client";

import Protected from "@/components/Protected";
import { cardCls } from "@/lib/ui";

export default function VendorPage() {
  return (
    <Protected role="vendor">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className={cardCls}>
          <h1 className="text-2xl font-bold">Vendor dashboard</h1>
          <p className="mt-2 text-gray-600">
            Service management and booking requests will be added on Day 11.
          </p>
        </div>
      </main>
    </Protected>
  );
}