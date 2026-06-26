import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing report ID" }, { status: 400 });
    }

    // Fetch report to verify ownership before deletion
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.user_id !== user.id && report.user_id !== null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the report
    const { error: deleteError } = await supabase
      .from("reports")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete report:", deleteError);
      return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }

    // If this was an authenticated user's report, deduct 10 points safely
    if (report.user_id === user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("civic_points")
        .eq("id", user.id)
        .single();

      if (profile) {
        // Calculate exactly how many points to deduct so we don't drop below 0
        const pointsToDeduct = Math.min(10, profile.civic_points || 0);
        if (pointsToDeduct > 0) {
          const { error: rpcError } = await supabase.rpc("increment_civic_points", {
            points_to_add: -pointsToDeduct,
          });
          if (rpcError) {
            console.error("Failed to decrement points:", rpcError);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unhandled error in DELETE /api/report/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
