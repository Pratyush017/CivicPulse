"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, Button, SeverityBadge, StatusPill } from "@/components/ui";

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
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Fetch existing reports ----
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ---- File selection helpers ----
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

  // ---- Submit a new report ----
  const handleSubmit = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Attempt geolocation
      let lat = 0;
      let lng = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
          })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Fallback: user can still submit without precise location
        console.warn("Geolocation unavailable, using (0, 0)");
      }

      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("latitude", String(lat));
      formData.append("longitude", String(lng));

      const res = await fetch("/api/report", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const { report } = await res.json();
      setReports((prev) => [report, ...prev]);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  // ---- UI ----
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-lg font-black text-slate-950">
              CH
            </div>
            <span className="text-lg font-bold tracking-tight">
              Community Hero
            </span>
          </div>
          <p className="hidden text-sm text-slate-400 sm:block">
            Hyperlocal Problem Solving
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ---- Upload Section ---- */}
        <section className="mb-12">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight">
            Report an Issue
          </h1>
          <p className="mb-6 text-slate-400">
            Upload a photo of a community problem. Our AI will classify and
            prioritise it automatically.
          </p>

          <Card className="p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragActive
                  ? "border-emerald-400 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mb-4 max-h-64 rounded-lg object-cover"
                />
              ) : (
                <>
                  <svg
                    className="mb-3 h-10 w-10 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm text-slate-400">
                    Drag &amp; drop an image, or{" "}
                    <span className="font-medium text-emerald-400">
                      click to browse
                    </span>
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleFileChange(e.target.files?.[0] ?? null)
                }
              />
            </div>

            {selectedFile && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  {selectedFile.name}
                </span>
                <Button onClick={handleSubmit} disabled={uploading}>
                  {uploading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Analysing…
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* ---- Reports Feed ---- */}
        <section>
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            Recent Reports
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            </div>
          ) : reports.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-16 text-center">
              <p className="mb-1 text-lg font-semibold text-slate-300">
                No reports yet
              </p>
              <p className="text-sm text-slate-500">
                Be the first to report an issue in your community!
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  {r.image_url && (
                    <img
                      src={r.image_url}
                      alt={r.title}
                      className="h-48 w-full object-cover"
                    />
                  )}
                  <div className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug">
                        {r.title}
                      </h3>
                      <SeverityBadge score={r.severity_score} />
                    </div>

                    <p className="line-clamp-2 text-sm text-slate-400">
                      {r.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <StatusPill status={r.status} />
                      <time>
                        {new Date(r.created_at).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
