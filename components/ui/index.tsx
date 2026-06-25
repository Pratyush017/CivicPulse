import React from "react";

/**
 * Reusable Card container with glassmorphism-inspired styling.
 */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Primary action button with gradient background.
 */
export function Button({
  children,
  className = "",
  disabled = false,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

/**
 * Severity badge with color coding.
 */
export function SeverityBadge({ score }: { score: number }) {
  const colors: Record<number, string> = {
    1: "bg-green-500/20 text-green-400 border-green-500/30",
    2: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    3: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    4: "bg-red-500/20 text-red-400 border-red-500/30",
    5: "bg-rose-600/20 text-rose-400 border-rose-600/30",
  };

  const labels: Record<number, string> = {
    1: "Minor",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Critical",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[score] ?? colors[3]}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {labels[score] ?? "Unknown"}
    </span>
  );
}

/**
 * Status pill that adapts colour to the current status string.
 */
export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let classes = "bg-slate-500/20 text-slate-400 border-slate-500/30";

  if (s === "reported")
    classes = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  else if (s === "in progress")
    classes = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  else if (s === "resolved")
    classes = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${classes}`}
    >
      {status}
    </span>
  );
}
