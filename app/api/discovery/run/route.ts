import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { discoverCandidates } from "../../../../lib/discovery/scraper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cronSecret =
    process.env.FRONTIER_CRON_SECRET;

  /*
   * Check whether this request came from the
   * automated scheduler.
   */
  const authorization =
    request.headers.get("authorization");

  const providedSecret =
    authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  const isAutomatedRequest =
    Boolean(
      cronSecret &&
      providedSecret &&
      providedSecret === cronSecret
    );

  /*
   * If this isn't the automated job, require
   * a logged-in Frontier admin.
   */
  if (!isAutomatedRequest) {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { data: admin } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!admin) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }
  }

  /*
   * Use the service-role client for system-level
   * discovery logging.
   *
   * This client NEVER runs in the browser.
   */
  const adminSupabase =
    createAdminClient();

  let discoveryRunId: string | null = null;

  const startedAt = new Date().toISOString();

  /*
   * Create the discovery run record before
   * starting the scraper.
   */
  try {
    const { data: run, error } =
      await adminSupabase
        .from("discovery_runs")
        .insert({
          started_at: startedAt,
          status: "running",
        })
        .select("id")
        .single();

    if (error) {
      console.error(
        "Failed to create discovery run:",
        error
      );
    } else {
      discoveryRunId = run.id;
    }
  } catch (error) {
    console.error(
      "Discovery run logging failed:",
      error
    );
  }

  try {
    console.log(
      "Frontier discovery started."
    );

    const candidates =
      await discoverCandidates();

    let inserted = 0;

    for (const candidate of candidates) {
      const { data, error } =
        await adminSupabase
          .from("incident_candidates")
          .upsert(
            {
              ...candidate,
              status: "pending",
            },
            {
              onConflict: "article_url",
              ignoreDuplicates: true,
            }
          )
          .select("id");

      if (error) {
        console.error(
          "Candidate insert error:",
          error
        );

        continue;
      }

      /*
       * When ignoreDuplicates is true,
       * Supabase returns no inserted row
       * when the article already exists.
       */
      if (data && data.length > 0) {
        inserted++;
      }
    }

    /*
     * Mark the discovery run successful.
     */
    if (discoveryRunId) {
      const { error } =
        await adminSupabase
          .from("discovery_runs")
          .update({
            completed_at:
              new Date().toISOString(),
            status: "success",
            discovered: candidates.length,
            inserted,
          })
          .eq("id", discoveryRunId);

      if (error) {
        console.error(
          "Failed to update discovery run:",
          error
        );
      }
    }

    console.log(
      `Frontier discovery complete. Found ${candidates.length}, inserted ${inserted}.`
    );

    return NextResponse.json({
      success: true,
      discovered: candidates.length,
      inserted,
    });
  } catch (error) {
    console.error(
      "Discovery failed:",
      error
    );

    /*
     * Record the failure in discovery_runs.
     */
    if (discoveryRunId) {
      await adminSupabase
        .from("discovery_runs")
        .update({
          completed_at:
            new Date().toISOString(),
          status: "failed",
          error_message:
            error instanceof Error
              ? error.message
              : "Unknown discovery error",
        })
        .eq("id", discoveryRunId);
    }

    return NextResponse.json(
      {
        error:
          "Discovery process failed.",
      },
      {
        status: 500,
      }
    );
  }
}