import React, { useEffect } from "react";
import { CheckCircle2, XCircle, Activity } from "lucide-react";

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    error: "border-red-500/40 bg-red-500/10 text-red-400",
    info: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  };

  const icons = {
    success: <CheckCircle2 className="size-4 flex-shrink-0" />,
    error: <XCircle className="size-4 flex-shrink-0" />,
    info: <Activity className="size-4 flex-shrink-0" />,
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-lg animate-in slide-in-from-top-2 fade-in duration-300 ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}
