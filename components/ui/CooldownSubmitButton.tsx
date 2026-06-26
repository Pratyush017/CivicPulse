"use client";

import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";

export function CooldownSubmitButton() {
  const [isUploading, setIsUploading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const totalCooldown = 59; // seconds

  const handleClick = () => {
    // 1. Simulate 1-second loading state
    setIsUploading(true);

    setTimeout(() => {
      // 2. After 1 second, upload finishes
      setIsUploading(false);
      setShowSuccess(true);
      setCooldown(totalCooldown);
    }, 1000);
  };

  // Handle the countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    } else if (cooldown === 0 && showSuccess) {
      // 3. When timer reaches 0, clear success message and re-enable
      setShowSuccess(false);
    }
    return () => clearInterval(timer);
  }, [cooldown, showSuccess]);

  // Calculate progress for the ring indicator
  const progress = (cooldown / totalCooldown) * 100;
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        onClick={handleClick}
        disabled={isUploading || cooldown > 0}
        className="relative w-48 bg-cyan-600 text-black font-bold hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed gap-2 h-10 px-6 transition-all duration-300"
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading...
          </>
        ) : cooldown > 0 ? (
          <div className="flex items-center gap-2">
            {/* Visual Progress Ring */}
            <div className="relative size-4 flex items-center justify-center">
              <svg className="size-full -rotate-90 transform" viewBox="0 0 20 20">
                <circle
                  cx="10"
                  cy="10"
                  r={radius}
                  className="fill-none stroke-black/20"
                  strokeWidth="3"
                />
                <circle
                  cx="10"
                  cy="10"
                  r={radius}
                  className="fill-none stroke-black transition-all duration-1000 ease-linear"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span>Please wait {cooldown}s</span>
          </div>
        ) : (
          <>
            <Upload className="size-4" />
            Submit Report
          </>
        )}
      </Button>

      {/* Temporary Success Notification */}
      <div
        className={`flex items-center gap-2 text-sm font-medium transition-opacity duration-300 ${
          showSuccess ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
        <span className="text-emerald-400">Report submitted successfully!</span>
      </div>
    </div>
  );
}
