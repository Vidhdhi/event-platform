import { ReactNode } from "react";

// Two-column layout shared by the login and register pages
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-4 py-10 lg:grid-cols-2">
      <section className="hidden lg:block">
        <h1 className="max-w-md text-5xl font-extrabold leading-[1.05]">
          Plan the whole event in one place.
        </h1>
        <p className="muted mt-4 max-w-md text-lg">
          Track your budget, compare vendors, and let the match score build
          your shortlist.
        </p>

        <div className="card float mt-10 max-w-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Colombo Wedding Studio</p>
              <p className="muted text-sm">Photography, Colombo</p>
            </div>
            <div className="rounded-xl bg-violet-600 px-3 py-1.5 text-center text-white">
              <p className="text-lg font-bold leading-none">94%</p>
              <p className="text-[10px]">match</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="chip chip-corporate">Within budget</span>
            <span className="chip chip-wedding">Same city</span>
            <span className="chip chip-birthday">4.8 from 20 reviews</span>
          </div>
          <p className="muted mt-3 text-xs">Example recommendation</p>
        </div>
      </section>

      <section className="rise">
        <div className="card mx-auto w-full max-w-md">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="muted mb-6 mt-1 text-sm">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}