"use client";

import { useState } from "react";

export default function PasswordField({
  label = "Password",
  value,
  onChange,
  minLength,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          className="input pr-16"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-700"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}