import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
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

  try {
    console.log(
      "Frontier discovery started."
    );

    const candidates =
      await discoverCandidates();

    let inserted = 0;

    for (const candidate of candidates) {
      const supabase = await createClient();

      const { error } =
        await supabase
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
          );

      if (error) {
        console.error(
          "Candidate insert error:",
          error
        );

        continue;
      }

      inserted++;
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