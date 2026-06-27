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

export function LoginButton() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
        // This dynamically reads the current domain the user is browsing!
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  if (session) {
    const name = session.user.user_metadata.full_name || session.user.email || "User";
    const initial = name.charAt(0).toUpperCase();

    return (
      <div className="flex items-center gap-4">
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
              {initial}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-[#e8eaf0] leading-tight">
              {name}
            </span>
            <span className="text-[11px] font-medium text-teal-400 leading-tight mt-0.5">
              {profile?.civic_points ?? 0} pts
            </span>
          </div>
        </div>
        <StarBorder
          as="button"
          onClick={handleSignOut}
          color="#f43f5e"
          className="ml-2 cursor-pointer"
          innerClassName="bg-slate-950 border border-white/10 hover:bg-slate-900 text-xs font-medium text-[#7a8199] hover:text-[#e8eaf0] px-3 py-1.5 flex items-center justify-center rounded-[20px] transition-colors"
        >
          <span className="hidden sm:inline">Sign out</span>
          <LogOut className="sm:hidden size-4" />
        </StarBorder>
      </div>
    );
  }

  return (
    <StarBorder as="button" color="#2dd4bf" onClick={handleSignIn} className="cursor-pointer font-semibold group border-0 p-0 m-0 bg-transparent">
      <div className="flex items-center gap-2">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden">Sign in</span>
      </div>
    </StarBorder>
  );
}
