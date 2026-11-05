import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // 1. Delete rejected candidates or items older than 30 days that were never published
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: deletedRejected, error: rejectErr } = await supabase
      .from("incidents")
      .delete()
      .or(`status.eq.rejected,relevance_score.lt.20`)
      .select("id");

    if (rejectErr) {
      console.error("Failed to prune rejected items:", rejectErr);
    }

    // 2. Delete stale unreviewed candidates older than 30 days
    const { data: deletedStale, error: staleErr } = await supabase
      .from("incidents")
      .delete()
      .eq("status", "pending")
      .lt("created_at", thirtyDaysAgo)
      .select("id");

    return NextResponse.json({
      success: true,
      prunedRejectedCount: deletedRejected?.length || 0,
      prunedStaleCount: deletedStale?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Pruning failed", details: error?.message },
      { status: 500 }
    );
  }
}