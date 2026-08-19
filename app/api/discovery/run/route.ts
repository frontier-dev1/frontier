import { NextResponse } from "next/server";

import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

import {
  discoverCandidates,
} from "../../../../lib/discovery/scraper";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request
) {
  const cronSecret =
    process.env.FRONTIER_CRON_SECRET;

  /*
   * ----------------------------------------------------------
   * 1. Authentication
   * ----------------------------------------------------------
   *
   * Automated GitHub/Vercel requests may use the cron secret.
   * Manual requests must come from a logged-in admin.
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

  if (!isAutomatedRequest) {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

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

    const {
      data: admin,
      error: adminError,
    } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify administrator access.",
        },
        {
          status: 500,
        }
      );
    }

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
   * ----------------------------------------------------------
   * 2. Create service-role Supabase client
   * ----------------------------------------------------------
   */

  const adminSupabase =
    createAdminClient();

  let discoveryRunId:
    | string
    | null = null;

  const startedAt =
    new Date().toISOString();

  /*
   * ----------------------------------------------------------
   * 3. Create discovery run record
   * ----------------------------------------------------------
   */

  try {
    const {
      data: run,
      error,
    } =
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

  /*
   * ----------------------------------------------------------
   * 4. Run discovery
   * ----------------------------------------------------------
   */

  try {
    console.log(
      "Frontier discovery started."
    );

    const candidates =
      await discoverCandidates();

    let inserted = 0;

    let duplicates = 0;

    let fetchSuccesses = 0;

    let fetchPartials = 0;

    let fetchFailures = 0;

    /*
     * --------------------------------------------------------
     * 5. Save every discovered candidate
     * --------------------------------------------------------
     */

    for (
      const candidate of candidates
    ) {
      /*
       * Track article retrieval quality.
       */

      if (
        candidate.article_fetch_status ===
        "success"
      ) {
        fetchSuccesses++;
      } else if (
        candidate.article_fetch_status ===
        "partial"
      ) {
        fetchPartials++;
      } else {
        fetchFailures++;
      }

      /*
       * Log useful information during development.
       */

      console.log(
        [
          "Candidate:",
          candidate.title,
          "|",
          "URL:",
          candidate.article_url,
          "|",
          "Resolved:",
          candidate.source_url,
          "|",
          "Article text:",
          candidate.article_text_length,
          "chars",
          "|",
          "Status:",
          candidate.article_fetch_status,
        ].join(" ")
      );

      /*
       * ------------------------------------------------------
       * Insert candidate.
       *
       * article_url is unique, so existing candidates are
       * ignored rather than overwritten.
       *
       * This is intentional.
       * ------------------------------------------------------
       */

      const {
        data,
        error,
      } =
        await adminSupabase
          .from("incident_candidates")
          .upsert(
            {
              id:
                candidate.id,

              title:
                candidate.title,

              source_name:
                candidate.source_name,

              source_url:
                candidate.source_url,

              article_url:
                candidate.article_url,

              summary:
                candidate.summary,

              published_at:
                candidate.published_at,

              discovered_at:
                candidate.discovered_at,

              status:
                "pending",

              relevance_score:
                candidate.relevance_score,

              matched_keywords:
                candidate.matched_keywords,

              notes:
                candidate.notes,

              article_text:
                candidate.article_text,

              article_text_source:
                candidate.article_text_source,

              article_text_fetched_at:
                candidate.article_text_fetched_at,

              article_text_length:
                candidate.article_text_length,

              article_fetch_status:
                candidate.article_fetch_status,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "article_url",

              ignoreDuplicates:
                true,
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

      if (
        data &&
        data.length > 0
      ) {
        inserted++;
      } else {
        duplicates++;
      }
    }

    /*
     * ----------------------------------------------------------
     * 6. Mark discovery successful
     * ----------------------------------------------------------
     */

    if (discoveryRunId) {
      const {
        error,
      } =
        await adminSupabase
          .from("discovery_runs")
          .update({
            completed_at:
              new Date().toISOString(),

            status:
              "success",

            discovered:
              candidates.length,

            inserted,
          })
          .eq(
            "id",
            discoveryRunId
          );

      if (error) {
        console.error(
          "Failed to update discovery run:",
          error
        );
      }
    }

    /*
     * ----------------------------------------------------------
     * 7. Logging
     * ----------------------------------------------------------
     */

    console.log(
      [
        "Frontier discovery complete.",
        `Found ${candidates.length}.`,
        `Inserted ${inserted}.`,
        `Duplicates ${duplicates}.`,
        `Article fetch success: ${fetchSuccesses}.`,
        `Article fetch partial: ${fetchPartials}.`,
        `Article fetch failed: ${fetchFailures}.`,
      ].join(" ")
    );

    /*
     * ----------------------------------------------------------
     * 8. Return results
     * ----------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      discovered:
        candidates.length,

      inserted,

      duplicates,

      article_fetch: {
        success:
          fetchSuccesses,

        partial:
          fetchPartials,

        failed:
          fetchFailures,
      },
    });
  } catch (error) {
    console.error(
      "Discovery failed:",
      error
    );

    /*
     * ----------------------------------------------------------
     * 9. Record discovery failure
     * ----------------------------------------------------------
     */

    if (discoveryRunId) {
      await adminSupabase
        .from("discovery_runs")
        .update({
          completed_at:
            new Date().toISOString(),

          status:
            "failed",

          error_message:
            error instanceof Error
              ? error.message
              : "Unknown discovery error",
        })
        .eq(
          "id",
          discoveryRunId
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Discovery process failed.",
      },
      {
        status: 500,
      }
    );
  }
}