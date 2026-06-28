"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence, Variants } from "motion/react";
import BlurText from "@/components/ui/BlurText";
import BubbleMenu from "@/components/ui/BubbleMenu";
import { Session } from "@supabase/supabase-js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
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
  List,
  Map,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toast } from "@/components/Toast";
import GradualBlur from "@/components/ui/GradualBlur";
import StarBorder from "@/components/ui/StarBorder";
import TiltedCard from "@/components/ui/TiltedCard";
import BorderGlow from "@/components/ui/BorderGlow";
import Folder from "@/components/ui/Folder";
import GooeyNav from "@/components/ui/GooeyNav";
import LaserFlow from "@/components/ui/LaserFlow";
import RotatingText from "@/components/ui/RotatingText";
import { createClient } from "@/utils/supabase/client";
import { HeaderActions } from "@/components/ui/LoginButton";

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

  // Map Emphasis state
  const [emphasizedSeverity, setEmphasizedSeverity] = useState<number | null>(null);

  const handleDockClick = (severityIndex: number) => {
    setEmphasizedSeverity(severityIndex);
    setTimeout(() => {
      setEmphasizedSeverity(null);
    }, 3000);
  };

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

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Highlight Filter State ---
  const [highlightedFilter, setHighlightedFilter] = useState<'active' | 'resolved' | 'attention' | 'critical' | null>(null);

  // --- Intro Animation State ---
  const [showIntro, setShowIntro] = useState(true);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [mobileView, setMobileView] = useState<'feed' | 'map'>('feed');
  const [headerScale, setHeaderScale] = useState(0.28);

  useEffect(() => {
    const handleResize = () => setHeaderScale(window.innerWidth < 640 ? 0.5 : 0.28);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // 1. Fade out the laser overlay first
    const timer1 = setTimeout(() => setShowIntroOverlay(false), 6000);
    // 2. Then shrink the logo and fade in the dashboard
    const timer2 = setTimeout(() => setShowIntro(false), 6800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    if (highlightedFilter) {
      const timer = setTimeout(() => {
        setHighlightedFilter(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedFilter]);

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
          const isAIErr = errMsg.startsWith("AI Triage") || errMsg.startsWith("AI Service") || errMsg.startsWith("AI Parsing");
          throw new Error(isAIErr ? errMsg : `AI Triage Rejected: ${errMsg}`);
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

  // --- Animation Variants ---
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: "spring", stiffness: 300, damping: 24 } 
    },
  };

  // --- Render ---
  return (
    <div className="dark">
      {/* ═══════════════════════ INTRO SEQUENCE ═══════════════════════ */}
      <AnimatePresence>
        {showIntroOverlay && (
          <motion.div
            initial={{ opacity: 1, clipPath: "inset(0% 0 0% 0)" }}
            exit={{ opacity: 0, clipPath: "inset(100% 0 0% 0)" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]"
          >
            <motion.div 
              className="absolute inset-0"
              initial={{ opacity: 0, y: 150 }}
              animate={{ opacity: 0.6, y: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <LaserFlow 
                color="#cf9eff" 
                horizontalBeamOffset={-0.02}
                verticalBeamOffset={-0.45}
                horizontalSizing={2}
                verticalSizing={4.4}
                wispDensity={2.1}
                wispSpeed={27}
                wispIntensity={20}
                flowSpeed={0.43}
                flowStrength={0.76}
                fogIntensity={1}
                fogScale={0.1}
                fogFallSpeed={0.26}
                decay={3}
                falloffStart={2.01}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ FLOATING LOGO ═══════════════════════ */}
      <motion.div
        className="fixed z-[200] font-display font-bold text-4xl sm:text-7xl tracking-tight leading-none flex items-center origin-top-left pointer-events-none whitespace-nowrap"
        initial={false}
        animate={showIntro ? "center" : "header"}
        variants={{
          center: { top: "50%", left: "50%", x: "-50%", y: "-50%", scale: 1 },
          header: { top: "18px", left: "70px", x: 0, y: 0, scale: headerScale }
        }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      >
        {showIntroOverlay ? (
          <>
            <BlurText
              text="Civic"
              delay={250}
              animateBy="letters"
              direction="top"
              className="text-white mt-1"
            />
            <BlurText
              text="Pulse"
              delay={250}
              animateBy="letters"
              direction="top"
              className="ml-2 sm:ml-3 bg-cyan-400 text-black px-4 pt-2 pb-1 rounded-xl overflow-hidden flex items-center justify-center leading-none"
            />
          </>
        ) : (
          <>
            <span className="text-white mt-1">Civic</span>
            <RotatingText
              texts={['Pulse', 'Radar']}
              mainClassName="ml-2 sm:ml-3 bg-cyan-400 text-black px-4 pt-2 pb-1 rounded-xl overflow-hidden flex items-center justify-center leading-none"
              staggerFrom={"last"}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={4000}
            />
          </>
        )}
      </motion.div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <motion.main 
        className="flex h-screen flex-col overflow-hidden bg-black text-slate-100"
        initial={{ opacity: 0, y: 100 }}
        animate={!showIntro ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        {/* ═══════════════════════ HEADER ═══════════════════════ */}
        <header className="relative z-20 flex items-center justify-between border-b border-[#111111] bg-[#050505] px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9">
              <div className="absolute inset-[-4px] rounded-[13px] border-2 border-teal-400 animate-[pulse-ring_2.4s_ease-out_infinite] opacity-0" />
              <div className="w-9 h-9 bg-teal-400 rounded-[9px] flex items-center justify-center">
                <Activity className="size-[18px] text-[#0f1117]" strokeWidth={2} />
              </div>
            </div>
            <div>
              <div className="flex items-center">
                  {/* Invisible placeholder for the floating logo */}
                  <div className="w-[120px] h-[28px]" />
              </div>
              <p className="text-[9px] md:text-[11px] text-[#7a8199] tracking-wide leading-tight">Community Issue Tracker</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="hidden items-center gap-3 md:flex">
            <div className="cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setHighlightedFilter(p => p === 'active' ? null : 'active')}>
              <BorderGlow borderRadius={30} backgroundColor="#000000" glowColor="173 80 50" colors={['#2dd4bf', '#14b8a6', '#0f766e']} edgeSensitivity={0} glowRadius={50} coneSpread={2}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[30px] border text-xs bg-teal-500/10 text-teal-400 transition-colors ${highlightedFilter === 'active' ? 'border-teal-400 bg-teal-500/20' : 'border-teal-500/20'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-[dot-breathe_2s_ease-in-out_infinite]" />
                  <span className="font-semibold font-display text-[#e8eaf0]">{activeReports.length}</span>
                  <span className="text-[#7a8199]">active</span>
                </div>
              </BorderGlow>
            </div>
            <div className="cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setHighlightedFilter(p => p === 'resolved' ? null : 'resolved')}>
              <BorderGlow borderRadius={30} backgroundColor="#000000" glowColor="0 0 100" colors={['#ffffff', '#e5e7eb', '#d1d5db']} edgeSensitivity={0} glowRadius={50} coneSpread={2}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[30px] border text-xs bg-white/5 text-white transition-colors ${highlightedFilter === 'resolved' ? 'border-white bg-white/10' : 'border-white/10'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="font-semibold font-display text-[#e8eaf0]">{resolvedReports.length}</span>
                  <span className="text-[#7a8199]">resolved</span>
                </div>
              </BorderGlow>
            </div>
            <div className="cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setHighlightedFilter(p => p === 'attention' ? null : 'attention')}>
              <BorderGlow borderRadius={30} backgroundColor="#000000" glowColor="43 96 56" colors={['#fbbf24', '#f59e0b', '#d97706']} edgeSensitivity={0} glowRadius={50} coneSpread={2}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[30px] border text-xs bg-amber-500/10 text-amber-400 transition-colors ${highlightedFilter === 'attention' ? 'border-amber-400 bg-amber-500/20' : 'border-amber-500/20'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="font-semibold font-display text-[#e8eaf0]">{needsAttentionCount}</span>
                  <span className="text-[#7a8199]">attention</span>
                </div>
              </BorderGlow>
            </div>
            <div className="cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setHighlightedFilter(p => p === 'critical' ? null : 'critical')}>
              <BorderGlow borderRadius={30} backgroundColor="#000000" glowColor="350 89 60" colors={['#f43f5e', '#e11d48', '#be123c']} edgeSensitivity={0} glowRadius={50} coneSpread={2}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[30px] border text-xs bg-rose-500/10 text-rose-400 transition-colors ${highlightedFilter === 'critical' ? 'border-rose-400 bg-rose-500/20' : 'border-rose-500/20'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-[dot-blink_1.8s_ease-in-out_infinite]" />
                  <span className="font-semibold font-display text-[#e8eaf0]">{criticalCount}</span>
                  <span className="text-[#7a8199]">critical</span>
                </div>
              </BorderGlow>
            </div>
          </div>

          {/* ═══════ Report Issue Dialog ═══════ */}
          <div className="flex items-center gap-2 md:gap-3">
            <HeaderActions 
              onReportClick={() => {
                if (session && reportCooldown === 0) {
                  setDialogOpen(true);
                } else if (!session) {
                  alert("Please sign in to report an issue and earn Civic Points!");
                } else {
                  alert(`Please wait ${reportCooldown}s before reporting again.`);
                }
              }}
              onHowItWorksClick={() => setShowHowItWorks(true)}
              onSeverityScaleClick={() => setMobileView('map')}
              onSeveritySelect={(severity) => {
                setMobileView('map');
                handleDockClick(severity);
              }}
            />
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >

            <DialogContent className="sm:max-w-lg bg-[#0a0a0a] border border-white/10 text-slate-100 ring-0">
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
                      <div className="mb-6 flex justify-center">
                        <Folder size={0.7} color="#22d3ee" />
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
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate={showIntro ? "hidden" : "show"}
          className="flex flex-col md:flex-row flex-1 w-full overflow-hidden"
        >
            {/* ────────── LEFT COLUMN: Report Feed (35%) ────────── */}
            <motion.aside variants={itemVariants} className={`w-full md:w-[400px] lg:w-[450px] ${mobileView === 'feed' ? 'flex' : 'hidden md:flex'} h-full overflow-y-auto z-10 bg-black flex-col border-r border-[#252d45] shadow-2xl relative`}>
            <div className="flex items-center border-b border-[#252d45] gap-4 px-6 pt-3 pb-3">
              <GooeyNav
                initialActiveIndex={viewMode === 'active' ? 0 : 1}
                onChange={(index) => setViewMode(index === 0 ? "active" : "resolved")}
                particleCount={6}
                timeVariance={100}
                colors={[173, 173, 173, 173]} // Teal-ish colors mapping if defined in CSS, else fallback
                items={[
                  {
                    label: (
                      <>
                        ACTIVE <span className="ml-1 bg-black/20 rounded-full px-2 py-0.5">{activeReports.length}</span>
                      </>
                    )
                  },
                  {
                    label: (
                      <>
                        RESOLVED <span className="ml-1 bg-black/20 rounded-full px-2 py-0.5">{resolvedReports.length}</span>
                      </>
                    )
                  }
                ]}
              />
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
                  let severityConfig: Record<string, string> = {
                    border: 'border-l-teal-400',
                    tag: 'bg-teal-500/12 text-teal-400',
                    dot: 'bg-teal-400',
                    label: 'Low',
                  };
                  if (report.severity_score >= 4) {
                    severityConfig = {
                      border: 'border-l-rose-500',
                      tag: 'bg-rose-500/13 text-rose-400',
                      dot: 'bg-rose-400',
                      label: 'Critical',
                    };
                  } else if (report.severity_score === 3) {
                    severityConfig = {
                      border: 'border-l-amber-400',
                      tag: 'bg-amber-500/13 text-amber-400',
                      dot: 'bg-amber-400',
                      label: 'Medium',
                    };
                  }
                  const s = severityConfig;
                  const relativeTime = dayjs(report.created_at).fromNow();

                  const starColor = report.severity_score === 1 ? '#2dd4bf' : report.severity_score === 2 ? '#f43f5e' : '#fbbf24';
                  const glowColor = report.severity_score === 1 ? '173 80 50' : report.severity_score === 2 ? '350 89 60' : '43 96 56';

                  const isHighlighted = highlightedFilter === 'active' ? report.status !== 'Resolved'
                                      : highlightedFilter === 'resolved' ? report.status === 'Resolved'
                                      : highlightedFilter === 'attention' ? (report.status !== 'Resolved' && report.severity_score >= 3)
                                      : highlightedFilter === 'critical' ? (report.status !== 'Resolved' && report.severity_score >= 4)
                                      : false;

                  return (
                    <TiltedCard
                      key={report.id}
                      className="mb-3 last:mb-0 w-full"
                      imageSrc=""
                      containerHeight="auto"
                      containerWidth="100%"
                      imageHeight="auto"
                      imageWidth="100%"
                      rotateAmplitude={5}
                      scaleOnHover={1.02}
                      showMobileWarning={false}
                      showTooltip={false}
                      displayOverlayContent={true}
                      overlayContent={
                        <BorderGlow
                          borderRadius={20}
                          backgroundColor="#0a0a0a"
                          glowColor={glowColor}
                          edgeSensitivity={isHighlighted ? 100 : 0}
                          glowRadius={70}
                          glowIntensity={isHighlighted ? 6.0 : 1.5}
                          coneSpread={isHighlighted ? 25 : 3}
                          colors={[starColor, starColor, starColor]}
                          className="w-full h-full"
                          animated={isHighlighted}
                          loopAnimation={isHighlighted}
                          animationSpeedMultiplier={isHighlighted ? 3 : 1}
                        >
                          <StarBorder
                            as="div"
                            color={starColor}
                            className="w-full h-full"
                            innerClassName={`bg-[#0a0a0a] rounded-[20px] overflow-hidden hover:bg-[#111111] transition-colors cursor-pointer flex flex-col w-full h-full`}
                            onClick={() => {
                              setFocusedCoords({ lat: report.latitude, lng: report.longitude });
                              setMobileView('map');
                            }}
                          >
                            {/* Top content */}
                      <div className="flex gap-3 p-3.5 pb-0">
                        {report.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={report.image_url} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 grayscale-[30%]" alt={report.title} />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-[#111111] flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between">
                            <p className="font-display font-semibold text-[13.5px] text-[#e8eaf0] leading-snug mb-1 line-clamp-1">
                              {report.title}
                            </p>
                            {session?.user?.id === report.user_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReport(report.id);
                                }}
                                className="ml-2 flex-shrink-0 text-[#7a8199] hover:text-rose-400 transition-colors"
                                title="Delete your report"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#7a8199] leading-relaxed line-clamp-2">
                            {report.description}
                          </p>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 px-3.5 py-2 mt-1">
                        <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md ${s.tag}`}>
                          <span className={`w-1 h-1 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <span className="ml-auto text-[11px] text-[#4a5068] flex items-center gap-1">
                          <Clock className="size-3" />
                          {relativeTime}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 px-3.5 pb-3.5">
                        {report.status === "Resolved" ? (
                          <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#7a8199] border border-white/10 rounded-lg cursor-default bg-white/5">
                            <CheckCircle2 className="size-3.5" />
                            Resolved
                          </div>
                        ) : (
                          <button
                            disabled={!session}
                            title={!session ? "Login to earn Civic Points" : ""}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#7a8199] border border-white/10 rounded-lg hover:bg-white/5 hover:text-[#e8eaf0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              openVerifyDialog(report);
                            }}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Verify Fix
                          </button>
                        )}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-teal-400 bg-teal-500/12 border border-teal-500/25 rounded-lg hover:bg-teal-500/20 transition-colors"
                        >
                          <Navigation className="size-3.5" />
                          Navigate
                        </a>
                      </div>
                      </StarBorder>
                    </BorderGlow>
                  }
                />
              );
            })
              )}
            </div>


            
            {/* Smooth blur fade for the scrollable feed */}
            <GradualBlur preset="bottom" height="4rem" zIndex={20} className="pointer-events-none" />
            </motion.aside>

          {/* ────────── RIGHT COLUMN: Map & Interactions (65%) ────────── */}
          <motion.section variants={itemVariants} className={`flex-1 relative ${mobileView === 'map' ? 'flex flex-col' : 'hidden md:flex'} h-full`}>
            {/* Leaflet map taking full background of right column */}
            <LeafletMap reports={filteredReports} viewMode={viewMode} focusCoords={focusedCoords} emphasizedSeverity={emphasizedSeverity} />

            {/* Map overlay legend */}
            <div className="hidden md:flex absolute bottom-[88px] left-1/2 -translate-x-1/2 md:bottom-6 md:left-6 md:translate-x-0 w-max z-10 items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur-lg shadow-2xl transform-gpu">
              {viewMode === "active" ? (
                <>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
                    Severity
                  </span>
                  <BorderGlow
                    className="hover:scale-[1.3] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform origin-bottom group cursor-pointer"
                    borderRadius={8}
                    backgroundColor="#020617"
                    glowColor="173 80 50"
                    edgeSensitivity={0}
                    glowRadius={70}
                    glowIntensity={1.0}
                    coneSpread={3}
                    disableCursorTracking
                    animateOnHover
                  >
                    <div 
                      className="flex items-center gap-1.5 hover:bg-slate-800/80 px-2.5 py-1.5 rounded-lg transition-all duration-300 relative h-full w-full"
                      onClick={() => handleDockClick(1)}
                    >
                      <span className="size-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                      <span className="text-xs font-medium text-slate-300 group-hover:text-cyan-400 transition-colors">Low</span>
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none border border-slate-700 shadow-xl whitespace-nowrap translate-y-2 group-hover:translate-y-0">
                        Click to highlight
                      </div>
                    </div>
                  </BorderGlow>
                  <BorderGlow
                    className="hover:scale-[1.3] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform origin-bottom group cursor-pointer"
                    borderRadius={8}
                    backgroundColor="#020617"
                    glowColor="43 96 56"
                    edgeSensitivity={0}
                    glowRadius={70}
                    glowIntensity={1.0}
                    coneSpread={3}
                    disableCursorTracking
                    animateOnHover
                  >
                    <div 
                      className="flex items-center gap-1.5 hover:bg-slate-800/80 px-2.5 py-1.5 rounded-lg transition-all duration-300 relative h-full w-full"
                      onClick={() => handleDockClick(2)}
                    >
                      <span className="size-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                      <span className="text-xs font-medium text-slate-300 group-hover:text-amber-400 transition-colors">Medium</span>
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none border border-slate-700 shadow-xl whitespace-nowrap translate-y-2 group-hover:translate-y-0">
                        Click to highlight
                      </div>
                    </div>
                  </BorderGlow>
                  <BorderGlow
                    className="hover:scale-[1.3] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform origin-bottom group cursor-pointer"
                    borderRadius={8}
                    backgroundColor="#020617"
                    glowColor="350 89 60"
                    edgeSensitivity={0}
                    glowRadius={70}
                    glowIntensity={1.0}
                    coneSpread={3}
                    disableCursorTracking
                    animateOnHover
                  >
                    <div 
                      className="flex items-center gap-1.5 hover:bg-slate-800/80 px-2.5 py-1.5 rounded-lg transition-all duration-300 relative h-full w-full"
                      onClick={() => handleDockClick(3)}
                    >
                      <span className="size-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      <span className="text-xs font-medium text-slate-300 group-hover:text-red-400 transition-colors">Critical</span>
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] uppercase font-bold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none border border-slate-700 shadow-xl whitespace-nowrap translate-y-2 group-hover:translate-y-0">
                        Click to highlight
                      </div>
                    </div>
                  </BorderGlow>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="text-xs font-medium text-slate-300">Resolved</span>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        </motion.div>

        {/* ═══════════════════ HOW IT WORKS DIALOG ═══════════════════ */}
        <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 text-slate-100 ring-0">
            <DialogHeader>
              <DialogTitle className="text-slate-50 text-lg">
                <span className="flex items-center gap-2">
                  <span className="text-xl">✨</span> How CivicPulse Works
                </span>
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Join the community effort to clean up our city. Report issues, verify fixes, and earn Civic Points!
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              <div className="space-y-3">
                <h4 className="text-teal-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="size-2 rounded-full bg-teal-400" />
                  Earning Points
                </h4>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2.5">
                    <span className="text-teal-400 font-bold w-12 shrink-0">+10 pt</span>
                    <span>Reporting a new verified issue (e.g. potholes, broken lights).</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="text-teal-400 font-bold w-12 shrink-0">+5 pt</span>
                    <span>Successfully verifying a fix with a clear photo.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="text-rose-400 font-bold w-12 shrink-0">-15 pt</span>
                    <span>Uploading fake images, stock photos, or unrelated content.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-indigo-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-400" />
                  Photo Guidelines
                </h4>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 marker:text-indigo-400 marker:font-bold">
                    <li><strong className="text-white">Real-time only:</strong> Take photos right at the location.</li>
                    <li><strong className="text-white">Clear context:</strong> Ensure the surrounding area is visible.</li>
                    <li><strong className="text-white">No screens:</strong> AI rejects photos of other screens.</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <DialogFooter className="bg-transparent border-slate-800">
              <Button onClick={() => setShowHowItWorks(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold">
                Got it!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════ VERIFICATION DIALOG ═══════════════════ */}
        <Dialog
          open={verifyDialogOpen}
          onOpenChange={(open) => {
            setVerifyDialogOpen(open);
            if (!open) resetVerifyForm();
          }}
        >
          <DialogContent className="sm:max-w-lg bg-[#0a0a0a] border border-white/10 text-slate-100 ring-0">
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
                ) : (
                  <>
                    <Search className="size-5 text-emerald-400" />
                    Verify Fix
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Mobile Floating Actions: Map Toggle & Bubble Menu */}
        <div className="md:hidden">
          {/* Bubble Menu Toggle (Bottom Left) */}
          <div className="fixed bottom-6 left-6 z-[100]">
            <BubbleMenu 
              logo={null}
              className="relative top-0 left-0 right-0 p-0 m-0 border-none justify-start"
              menuBg="#050505"
              menuContentColor="#fff"
              useFixedPosition={false}
              items={[
                {
                  label: (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-display font-bold text-teal-400">{activeReports.length}</span>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active</span>
                    </div>
                  ),
                  href: '#',
                  rotation: -8,
                  hoverStyles: { bgColor: '#0f766e', textColor: '#ffffff' },
                  onClick: () => setHighlightedFilter(p => p === 'active' ? null : 'active')
                },
                {
                  label: (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-display font-bold text-green-400">{resolvedReports.length}</span>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolved</span>
                    </div>
                  ),
                  href: '#',
                  rotation: 8,
                  hoverStyles: { bgColor: '#166534', textColor: '#ffffff' },
                  onClick: () => setHighlightedFilter(p => p === 'resolved' ? null : 'resolved')
                },
                {
                  label: (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-display font-bold text-amber-400">{needsAttentionCount}</span>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Attention</span>
                    </div>
                  ),
                  href: '#',
                  rotation: -8,
                  hoverStyles: { bgColor: '#b45309', textColor: '#ffffff' },
                  onClick: () => setHighlightedFilter(p => p === 'attention' ? null : 'attention')
                },
                {
                  label: (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-display font-bold text-rose-400">{criticalCount}</span>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Critical</span>
                    </div>
                  ),
                  href: '#',
                  rotation: 8,
                  hoverStyles: { bgColor: '#be123c', textColor: '#ffffff' },
                  onClick: () => setHighlightedFilter(p => p === 'critical' ? null : 'critical')
                }
              ]}
            />
          </div>

          {/* Bottom Navigation for Feed/Map */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 p-1.5 bg-[#0a0f1a]/80 backdrop-blur-xl border border-[#1e293b]/50 rounded-2xl shadow-2xl transform-gpu">
            <button 
              onClick={() => setMobileView('feed')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold tracking-wide ${mobileView === 'feed' ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <List className="size-4" />
              <span className="text-xs uppercase">Feed</span>
            </button>
            <button 
              onClick={() => setMobileView('map')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold tracking-wide ${mobileView === 'map' ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <MapPin className="size-4" />
              <span className="text-xs uppercase">Map</span>
            </button>
          </div>
        </div>
      </motion.main>

    </div>
  );
}
