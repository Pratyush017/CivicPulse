import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/reports
 * Returns all reports ordered by most recent first.
 */
export async function GET() {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }

  return NextResponse.json({ reports: data });
}
