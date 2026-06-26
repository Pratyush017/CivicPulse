import { Shield, AlertTriangle, Flame } from "lucide-react";

export type SeverityLevel = "low" | "medium" | "critical";

export function getSeverityLevel(score: number): SeverityLevel {
  if (score <= 2) return "low";
  if (score <= 3) return "medium";
  return "critical";
}

export function getSeverityConfig(level: SeverityLevel) {
  const configs = {
    low: {
      label: "Low",
      badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
      pinBackground: "#06b6d4",
      pinGlyph: "#083344",
      pinBorder: "#22d3ee",
    },
    medium: {
      label: "Medium",
      badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
      pinBackground: "#f59e0b",
      pinGlyph: "#451a03",
      pinBorder: "#fbbf24",
    },
    critical: {
      label: "Critical",
      badge: "bg-red-500/20 text-red-400 border-red-500/40",
      pinBackground: "#ef4444",
      pinGlyph: "#450a0a",
      pinBorder: "#f87171",
    },
  };
  return configs[level];
}

export function SeverityBadge({ score }: { score: number }) {
  const level = getSeverityLevel(score);
  const config = getSeverityConfig(level);
  const Icon =
    level === "critical" ? Flame : level === "medium" ? AlertTriangle : Shield;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${config.badge}`}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
