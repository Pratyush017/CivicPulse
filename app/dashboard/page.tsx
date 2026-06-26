"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Session } from "@supabase/supabase-js";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-950">
      <Loader2 className="size-8 animate-spin text-cyan-500" strokeWidth={1.5} />
    </div>
  ),
});
import {
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Shield,
  ShieldCheck,
  Upload,
  Clock,
  Timer,
  Activity,
  Search,
  XCircle,
  Trash2,
  ImageIcon,
  Navigation,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Toast } from "@/components/Toast";
import { createClient } from "@/utils/supabase/client";
import { LoginButton } from "@/components/ui/LoginButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  severity_score: number;
  latitude: number;
  longitude: number;
  image_url: string;
  status: string;
  created_at: string;
  user_id?: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  // --- State ---
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"active" | "resolved">("active");
  const [focusedCoords, setFocusedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportCooldown, setReportCooldown] = useState(0);

  // Cooldown countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (reportCooldown > 0) {
      timer = setInterval(() => {
        setReportCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [reportCooldown]);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "fetching" | "success" | "error"
  >("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Verification state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyingReport, setVerifyingReport] = useState<Report | null>(null);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyPreviewUrl, setVerifyPreviewUrl] = useState<string | null>(null);
  const [verifyDragActive, setVerifyDragActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    is_same_location: boolean;
    is_resolved: boolean;
    reasoning: string;
  } | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // --- Auth State ---
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Derived filtered reports ---
  const filteredReports = useMemo(() => {
    if (viewMode === "active") return reports.filter((r) => r.status !== "Resolved");
    return reports.filter((r) => r.status === "Resolved");
  }, [reports, viewMode]);

  // --- Memos ---
  const activeReports = useMemo(() => reports.filter((r) => r.status !== "Resolved"), [reports]);
  const resolvedReports = useMemo(() => reports.filter((r) => r.status === "Resolved"), [reports]);
  const needsAttentionCount = useMemo(() => activeReports.filter((r) => r.severity_score >= 3).length, [activeReports]);
  const criticalCount = useMemo(() => activeReports.filter((r) => r.severity_score >= 4).length, [activeReports]);

  // --- Fetch reports on mount (exclude resolved) ---
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        const allReports: Report[] = data.reports ?? [];
        // Show all reports, including resolved
        setReports(allReports);
      }
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [fetchReports]);



  // --- File handling (Report) ---
  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(file);
  };

  // --- File handling (Verify) ---
  const handleVerifyFileChange = (file: File | null) => {
    setVerifyFile(file);
    if (file) {
      setVerifyPreviewUrl(URL.createObjectURL(file));
    } else {
      setVerifyPreviewUrl(null);
    }
  };

  const handleVerifyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVerifyDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleVerifyFileChange(file);
  };

  // --- Delete Report ---
  const handleDeleteReport = async (reportId: string) => {
    // Optimistic UI update
    const previousReports = [...reports];
    setReports((prev) => prev.filter((r) => r.id !== reportId));

    try {
      const res = await fetch(`/api/report/${reportId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete report");
      }

      setToast({ message: "Report deleted", type: "success" });
      window.dispatchEvent(new CustomEvent("civicPointsUpdate"));
    } catch (err) {
      console.error(err);
      // Revert optimistic update
      setReports(previousReports);
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete report",
        type: "error",
      });
    }
  };

  // --- Geolocation ---
  const handleUseMyLocation = () => {
    setLocationStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("success");
      },
      () => {
        setLocationStatus("error");
      },
      { timeout: 10000 }
    );
  };

  // --- Submit report ---
  const handleSubmit = async () => {
    if (isSubmittingRef.current || isUploading) return;
    if (!selectedFile) return;

    isSubmittingRef.current = true;
    setIsUploading(true);
    abortControllerRef.current = new AbortController();

    try {
      let lat = coords?.lat ?? 0;
      let lng = coords?.lng ?? 0;

      if (!coords) {
        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
              })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          console.warn("Geolocation unavailable, using (0, 0)");
        }
      }

      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("latitude", String(lat));
      formData.append("longitude", String(lng));

      const res = await fetch("/api/report", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 400 && err.error) {
          const errMsg = String(err.error);
          throw new Error(errMsg.startsWith("AI Triage") ? errMsg : `AI Triage Rejected: ${errMsg}`);
        }
        throw new Error(err.error ?? "Upload failed");
      }

      const { report } = await res.json();

      setReports((prev) => [report, ...prev]);
      resetForm();
      setDialogOpen(false);
      setToast({ message: "Report submitted successfully!", type: "success" });
      setReportCooldown(59);
      
      // Notify LoginButton to refresh points
      window.dispatchEvent(new CustomEvent("civicPointsUpdate"));
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError") {
        console.log("Upload aborted by user");
        return;
      }
      console.error(err);
      setToast({
        message: error.message || "Something went wrong",
        type: "error",
      });
      // Do NOT reset the form or close the dialog, let the user try again
    } finally {
      isSubmittingRef.current = false;
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const resetForm = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCoords(null);
    setLocationStatus("idle");
    setDragActive(false);
  };

  // --- Open verify dialog ---
  const openVerifyDialog = (report: Report) => {
    setVerifyingReport(report);
    setVerifyFile(null);
    setVerifyPreviewUrl(null);
    setVerifyResult(null);
    setVerifyDragActive(false);
    setIsVerifying(false);
    setVerifyDialogOpen(true);
  };

  const resetVerifyForm = () => {
    setVerifyingReport(null);
    setVerifyFile(null);
    setVerifyPreviewUrl(null);
    setVerifyResult(null);
    setVerifyDragActive(false);
    setIsVerifying(false);
  };

  // --- Submit verification ---
  const handleVerifySubmit = async () => {
    if (isSubmittingRef.current || isVerifying) return;
    if (!verifyFile || !verifyingReport) return;

    isSubmittingRef.current = true;
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      // Capture user GPS for proximity check
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        }
      ).catch(() => null);

      if (!position) {
        throw new Error(
          "GPS access denied. Please enable location services to verify a fix."
        );
      }

      const formData = new FormData();
      formData.append("image", verifyFile);
      formData.append("report_id", verifyingReport.id);
      formData.append("user_lat", String(position.coords.latitude));
      formData.append("user_lng", String(position.coords.longitude));

      const res = await fetch("/api/verify", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        // If it's a spoof detection with verification data, show the reasoning
        if (err.verification) {
          setVerifyResult(err.verification);
          setToast({
            message: err.error ?? "Verification rejected by AI.",
            type: "error",
          });
          return;
        }
        throw new Error(err.error ?? "Verification failed");
      }

      const data = await res.json();
      const verification = data.verification as {
        is_same_location: boolean;
        is_resolved: boolean;
        reasoning: string;
      };

      setVerifyResult(verification);

      if (verification.is_same_location && verification.is_resolved) {
        // Update local state to show 'Resolved'
        setReports((prev) =>
          prev.map((r) =>
            r.id === verifyingReport.id ? { ...r, status: "Resolved" } : r
          )
        );

        setToast({
          message: `"${verifyingReport.title}" verified as resolved!`,
          type: "success",
        });

        // Notify LoginButton to refresh points
        window.dispatchEvent(new CustomEvent("civicPointsUpdate"));

        // Auto-close after a brief delay so user sees the success result
        setTimeout(() => {
          setVerifyDialogOpen(false);
          resetVerifyForm();
        }, 2500);
      } else if (!verification.is_same_location) {
        setToast({
          message:
            "Location mismatch detected. Photos must be from the same spot.",
          type: "error",
        });
      } else {
        setToast({
          message: "AI could not confirm the fix. Issue remains active.",
          type: "info",
        });
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err instanceof Error ? err.message : "Verification failed",
        type: "error",
      });
    } finally {
      isSubmittingRef.current = false;
      setIsVerifying(false);
    }
  };

  // --- Render ---
  return (
    <div className="dark">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        {/* ═══════════════════════ HEADER ═══════════════════════ */}
        <header className="relative z-20 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-6 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/20">
              <Activity className="size-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                CivicPulse
              </h1>
              <p className="text-xs text-slate-500">
                Community Issue Tracker
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="hidden items-center gap-6 md:flex">
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">
                {activeReports.length}
              </p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">
                {resolvedReports.length}
              </p>
              <p className="text-xs text-slate-500">Resolved</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">
                {needsAttentionCount}
              </p>
              <p className="text-xs text-slate-500">Attention</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">
                {criticalCount}
              </p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
          </div>

          {/* ═══════ Report Issue Dialog ═══════ */}
          <div className="flex items-center gap-4">
            <LoginButton />
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <span title={!session ? "Login to earn Civic Points" : reportCooldown > 0 ? "Please wait before reporting again" : ""}>
                <DialogTrigger
                  render={
                    <Button 
                      disabled={!session || reportCooldown > 0}
                      className="bg-cyan-600 text-black font-bold hover:bg-cyan-500 shadow-lg shadow-cyan-600/25 transition-all hover:shadow-cyan-500/40 cursor-pointer gap-2 px-4 py-2 h-9 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none"
                    >
                      {reportCooldown > 0 ? (
                        <>
                          <Timer className="size-4" />
                          Wait {reportCooldown}s
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" />
                          Report Issue
                        </>
                      )}
                    </Button>
                  }
                />
              </span>

            <DialogContent className="sm:max-w-lg bg-slate-900 border border-slate-700 text-slate-100 ring-0">
              <DialogHeader>
                <DialogTitle className="text-slate-50 text-lg">
                  <span className="flex items-center gap-2">
                    <Camera className="size-5 text-cyan-400" />
                    Report a Civic Issue
                  </span>
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Upload a photo of a community problem. Our AI will
                  classify and prioritize it automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* File Upload Zone */}
                {!previewUrl ? (
                  <div className="flex flex-col gap-4">
                    {/* Desktop View (Hidden on Mobile) */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => galleryInputRef.current?.click()}
                      className={`group hidden md:flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
                        dragActive
                          ? "border-cyan-500 bg-cyan-500/5"
                          : "border-slate-700 hover:border-cyan-500 hover:bg-slate-800/50 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-slate-800 transition-colors group-hover:bg-cyan-500/10">
                        <Upload className="size-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <p className="text-sm">
                        Drag & drop an image, or{" "}
                        <span className="font-semibold text-cyan-400">
                          click to browse
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        JPG, PNG, WEBP up to 10MB
                      </p>
                    </div>

                    {/* Mobile View (Hidden on Desktop) */}
                    <div className="flex md:hidden gap-4 w-full">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="min-h-[60px] flex-1 flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-xl active:bg-slate-800 text-slate-300 gap-2 transition-colors"
                      >
                        <Camera className="size-5" />
                        <span className="text-sm font-semibold">Take Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="min-h-[60px] flex-1 flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-xl active:bg-slate-800 text-slate-300 gap-2 transition-colors"
                      >
                        <ImageIcon className="size-5" />
                        <span className="text-sm font-semibold">Gallery</span>
                      </button>
                    </div>

                    {/* Hidden Inputs */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        handleFileChange(e.target.files?.[0] ?? null)
                      }
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        handleFileChange(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                ) : (
                  <div className="relative flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 w-full rounded-lg object-cover shadow-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileChange(null);
                      }}
                      className="mt-3 w-full rounded-lg bg-slate-800/50 py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      Remove Image
                    </button>
                  </div>
                )}

                {/* Use My Location */}
                <Button
                  variant="outline"
                  className="w-full border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 cursor-pointer gap-2 h-10"
                  onClick={handleUseMyLocation}
                  disabled={locationStatus === "fetching"}
                >
                  {locationStatus === "fetching" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : locationStatus === "success" ? (
                    <MapPin className="size-4 text-cyan-400" />
                  ) : (
                    <MapPin className="size-4" />
                  )}
                  {locationStatus === "success"
                    ? `Location: ${coords?.lat.toFixed(4)}, ${coords?.lng.toFixed(4)}`
                    : locationStatus === "fetching"
                      ? "Getting location…"
                      : locationStatus === "error"
                        ? "Location failed — try again"
                        : "Use My Location"}
                </Button>
              </div>

              <DialogFooter className="bg-transparent border-slate-800">
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedFile || isUploading}
                  className="bg-cyan-600 text-black font-bold hover:bg-cyan-500 disabled:opacity-40 cursor-pointer gap-2 h-9 px-6"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Analyzing with AI…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Submit Report
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        </header>

        {/* ═══════════════════════ BODY ═══════════════════════ */}
        <div className="flex flex-col md:flex-row flex-1 w-full overflow-hidden">
          {/* ────────── LEFT COLUMN: Report Feed (35%) ────────── */}
          <aside className="w-full md:w-[400px] lg:w-[450px] h-[50vh] md:h-full overflow-y-auto z-10 bg-slate-950 flex flex-col border-r border-slate-800/80 shadow-2xl relative">
            {/* View Mode Toggle */}
            <div className="flex items-center border-b border-slate-800/50 p-2 gap-1">
              <button
                onClick={() => setViewMode("active")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-xs md:text-sm font-semibold tracking-wide uppercase transition-all duration-200 ${
                  viewMode === "active"
                    ? "bg-cyan-950 text-cyan-400 border border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <Activity className="size-3.5" />
                Active Issues
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  viewMode === "active" ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-500"
                }`}>{activeReports.length}</span>
              </button>
              <button
                onClick={() => setViewMode("resolved")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-xs md:text-sm font-semibold tracking-wide uppercase transition-all duration-200 ${
                  viewMode === "resolved"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <ShieldCheck className="size-3.5" />
                Resolved
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  viewMode === "resolved" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
                }`}>{resolvedReports.length}</span>
              </button>
            </div>

            {/* Scrollable feed */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="size-8 animate-spin text-cyan-500" />
                  <p className="text-sm text-slate-500">Loading reports…</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
                    {viewMode === "active" ? (
                      <Shield className="size-7 text-cyan-700" />
                    ) : (
                      <ShieldCheck className="size-7 text-emerald-700" />
                    )}
                  </div>
                  <div className="text-center max-w-[240px]">
                    <p className="font-semibold text-slate-400">
                      {viewMode === "active" ? "All Clear" : "No Resolved Issues"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {viewMode === "active"
                        ? "No active issues in this sector. The community is secure."
                        : "No issues resolved yet. Be the first Community Hero to verify a fix!"}
                    </p>
                  </div>
                </div>
              ) : (
                filteredReports.map((report) => {
                  return (
                    <Card
                      key={report.id}
                      onClick={() => setFocusedCoords({ lat: report.latitude, lng: report.longitude })}
                      className="group/report min-h-[44px] cursor-pointer border-slate-800/50 bg-slate-900/40 transition-all duration-300 hover:bg-slate-800/60 hover:border-cyan-900/50 hover:shadow-[0_0_15px_rgba(8,145,178,0.15)] ring-0"
                    >
                      <div className="flex gap-3 p-3">
                        {/* Thumbnail */}
                        {report.image_url && (
                          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={report.image_url}
                              alt={report.title}
                              width={80}
                              height={80}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover/report:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex flex-1 flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-start justify-between">
                              <h3 className="text-sm font-semibold text-slate-200 leading-snug line-clamp-1">
                                {report.title}
                              </h3>
                              {session?.user?.id === report.user_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteReport(report.id);
                                  }}
                                  className="ml-2 flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors"
                                  title="Delete your report"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 line-clamp-3">
                              {report.description}
                            </p>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <SeverityBadge score={report.severity_score} />
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                              <Clock className="size-3" />
                              {new Date(
                                report.created_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ── Verify Fix or Resolved State & Navigation ── */}
                      <div className="border-t border-slate-800/60 px-3 py-2 flex items-center gap-2">
                        <div className="flex-1">
                          {report.status === "Resolved" ? (
                            <div className="flex items-center justify-center gap-1.5 h-7 w-full text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-md border border-emerald-500/20 cursor-default">
                              <CheckCircle2 className="size-3.5" />
                              Resolved
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!session}
                              title={!session ? "Login to earn Civic Points" : ""}
                              className="w-full border-slate-700/60 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 cursor-pointer gap-1.5 h-7 text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                openVerifyDialog(report);
                              }}
                            >
                              <CheckCircle2 className="size-3.5" />
                              Verify Fix
                            </Button>
                          )}
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center h-7 px-3 gap-1.5 text-xs font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors"
                        >
                          <Navigation className="size-3.5" />
                          Navigate
                        </a>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </aside>

          {/* ────────── RIGHT COLUMN: Map (65%) ────────── */}
          <section className="w-full h-[50vh] md:h-full md:flex-1 relative z-0">
            <LeafletMap reports={filteredReports} viewMode={viewMode} focusCoords={focusedCoords} />

            {/* Map overlay legend */}
            <div className="absolute bottom-6 left-6 z-10 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-2.5 backdrop-blur-lg shadow-2xl">
              {viewMode === "active" ? (
                <>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                    Severity
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-cyan-500" />
                    <span className="text-xs text-slate-400">Low</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-400">Medium</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-400">Critical</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-400">Resolved</span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* ═══════════════════ VERIFICATION DIALOG ═══════════════════ */}
        <Dialog
          open={verifyDialogOpen}
          onOpenChange={(open) => {
            setVerifyDialogOpen(open);
            if (!open) resetVerifyForm();
          }}
        >
          <DialogContent className="sm:max-w-lg bg-slate-900 border border-slate-700 text-slate-100 ring-0">
            <DialogHeader>
              <DialogTitle className="text-slate-50 text-lg">
                <span className="flex items-center gap-2">
                  <Search className="size-5 text-emerald-400" />
                  Verify Fix
                </span>
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Upload a photo proving this issue has been fixed. Our AI
                will analyze whether the repair is visible.
              </DialogDescription>
            </DialogHeader>

            {/* Report being verified */}
            {verifyingReport && (
              <div className="flex gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                {verifyingReport.image_url && (
                  <Image
                    src={verifyingReport.image_url}
                    alt={verifyingReport.title}
                    width={56}
                    height={56}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 line-clamp-1">
                    {verifyingReport.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {verifyingReport.category} · Severity{" "}
                    {verifyingReport.severity_score}/5
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Verification Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setVerifyDragActive(true);
                }}
                onDragLeave={() => setVerifyDragActive(false)}
                onDrop={handleVerifyDrop}
                onClick={() => verifyFileInputRef.current?.click()}
                className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-200 ${
                  verifyDragActive
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-slate-700 hover:border-emerald-500 hover:bg-slate-800/50"
                }`}
              >
                {verifyPreviewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={verifyPreviewUrl}
                      alt="Verification preview"
                      className="max-h-40 rounded-lg object-cover shadow-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerifyFileChange(null);
                      }}
                      className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-lg hover:bg-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-slate-800 transition-colors group-hover:bg-emerald-500/10">
                      <Camera className="size-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-400">
                      Upload a photo of the{" "}
                      <span className="font-semibold text-emerald-400">
                        repaired area
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Show the fix clearly for AI verification
                    </p>
                  </>
                )}
                <input
                  ref={verifyFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) =>
                    handleVerifyFileChange(e.target.files?.[0] ?? null)
                  }
                />
              </div>

              {/* Verification Result */}
              {verifyResult && (
                <div
                  className={`rounded-lg border p-3 ${
                    verifyResult.is_same_location && verifyResult.is_resolved
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : !verifyResult.is_same_location
                        ? "border-red-500/40 bg-red-500/10"
                        : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  {/* Location match indicator */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {verifyResult.is_same_location ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <XCircle className="size-4 text-red-400" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        verifyResult.is_same_location
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {verifyResult.is_same_location
                        ? "Location Verified ✓"
                        : "Location Mismatch ✗"}
                    </span>
                  </div>
                  {/* Resolution indicator */}
                  <div className="flex items-center gap-2 mb-2">
                    {verifyResult.is_resolved ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <XCircle className="size-4 text-amber-400" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        verifyResult.is_resolved
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {verifyResult.is_resolved
                        ? "Issue Resolved ✓"
                        : "Issue Not Resolved"}
                    </span>
                  </div>
                  {/* Overall verdict */}
                  <div className={`text-sm font-bold mb-1.5 ${
                    verifyResult.is_same_location && verifyResult.is_resolved
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}>
                    {verifyResult.is_same_location && verifyResult.is_resolved
                      ? "✓ Verification Passed — Issue Confirmed Resolved"
                      : !verifyResult.is_same_location
                        ? "✗ Verification Failed — Spoof Detected"
                        : "✗ Verification Failed — Issue Still Active"}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {verifyResult.reasoning}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="bg-transparent border-slate-800">
              <Button
                onClick={handleVerifySubmit}
                disabled={!verifyFile || isVerifying || verifyResult !== null}
                className="bg-emerald-600 text-black font-bold hover:bg-emerald-500 disabled:opacity-40 cursor-pointer gap-2 h-9 px-6"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    AI is analyzing repair…
                  </>
                ) : verifyResult ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Analysis Complete
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Verify Fix
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
