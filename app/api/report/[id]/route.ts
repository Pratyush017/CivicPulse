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

    // Delete the report if the user_id matches the authenticated user OR if it's a seed report (user_id is NULL)
    const { data, error } = await supabase
      .from("reports")
      .delete()
      .eq("id", id)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .select();

    if (error) {
      console.error("Failed to delete report:", error);
      return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Unauthorized or report not found" }, { status: 403 });
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
