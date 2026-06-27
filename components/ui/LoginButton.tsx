"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Session } from "@supabase/supabase-js";

interface Profile {
  civic_points: number;
  avatar_url: string;
}

import StarBorder from "@/components/ui/StarBorder";
import { LogOut } from "lucide-react";
import { StaggeredMenu } from "@/components/ui/StaggeredMenu";
export function HeaderActions({ 
  onReportClick, 
  onHowItWorksClick,
  onSeverityScaleClick,
  onSeveritySelect
}: { 
  onReportClick: () => void,
  onHowItWorksClick: () => void,
  onSeverityScaleClick: () => void,
  onSeveritySelect?: (severity: number) => void
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuMode, setMenuMode] = useState<'main' | 'severity'>('main');
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("civic_points, avatar_url")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const handleUpdate = () => {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession) fetchProfile(currentSession.user.id);
      });
    };

    window.addEventListener("civicPointsUpdate", handleUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("civicPointsUpdate", handleUpdate);
    };
  }, [supabase, fetchProfile]);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const mainMenuItems = [
    { label: "Report Issue", ariaLabel: "Report Issue", action: onReportClick },
    { label: "How It Works", ariaLabel: "How It Works guide", action: onHowItWorksClick },
    { label: "Severity Map", ariaLabel: "View Map Severity Scale", action: () => {
      setMenuMode('severity');
    }, preventClose: true },
    ...(session
      ? [{ label: "Sign Out", ariaLabel: "Sign out of your account", action: handleSignOut }]
      : [{ label: "Sign In", ariaLabel: "Sign in with Google", action: handleSignIn }])
  ];

  const severityMenuItems = [
    { label: "Low", ariaLabel: "Low Severity", action: () => onSeveritySelect?.(1), color: '#2dd4bf' },
    { label: "Medium", ariaLabel: "Medium Severity", action: () => onSeveritySelect?.(2), color: '#fbbf24' },
    { label: "High", ariaLabel: "High Severity", action: () => onSeveritySelect?.(3), color: '#f43f5e' },
    { label: "← Back", ariaLabel: "Go back", action: () => setMenuMode('main'), preventClose: true }
  ];

  const menuItems = menuMode === 'main' ? mainMenuItems : severityMenuItems;

  return (
    <div className="flex items-center gap-4">
      {session && (
        <div className="flex items-center gap-2.5">
          {profile?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="size-[34px] rounded-full object-cover"
            />
          ) : (
            <div className="flex size-[34px] items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-display font-bold text-sm">
              {(session.user.user_metadata.full_name || session.user.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-[#e8eaf0] leading-tight">
              {session.user.user_metadata.full_name || session.user.email || "User"}
            </span>
            <span className="text-[11px] font-medium text-teal-400 leading-tight mt-0.5">
              {profile?.civic_points ?? 0} pts
            </span>
          </div>
        </div>
      )}
      
      {/* 
        The StaggeredMenu toggle button sits inline, 
        but its menu panel opens fixed to cover the screen.
      */}
      <StaggeredMenu items={menuItems} />
    </div>
  );
}
