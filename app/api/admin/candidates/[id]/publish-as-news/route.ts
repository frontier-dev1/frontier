import { NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const adminSupabase = createAdminClient();

    const { data: candidate, error: candidateError } =
      await adminSupabase
        .from("incident_candidates")
        .select("*")
        .eq("id", id)
        .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Incident candidate not found." },
        { status: 404 }
      );
    }

    const summary =
      candidate.ai_incident_summary ||
      candidate.ai_evidence_summary ||
      candidate.summary;

    if (!summary) {
      return NextResponse.json(
        {
          error:
            "This candidate has no summary yet — run AI review first.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: upsertError } = await adminSupabase
      .from("ai_news")
      .upsert(
        {
          title: candidate.title,
          source_name:
            candidate.source_name || "Unknown",
          source_url: candidate.source_url,
          article_url: candidate.article_url,
          summary,
          category: candidate.ai_category,
          published_at: candidate.published_at,
          article_text: candidate.article_text,
          article_text_source:
            candidate.article_text_source,
          article_text_fetched_at:
            candidate.article_text_fetched_at,
          article_text_length:
            candidate.article_text_length ?? 0,
          article_fetch_status:
            candidate.article_fetch_status || "success",
          ai_summary: summary,
          ai_category: candidate.ai_category,
          ai_company: candidate.ai_company,
          ai_model: candidate.ai_model,
          ai_reasoning:
            "Published from an incident candidate by admin.",
          ai_reviewed_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          onConflict: "source_url",
          ignoreDuplicates: true,
        }
      );

    if (upsertError) {
      console.error(
        "Failed to publish incident candidate as news:",
        upsertError
      );

      return NextResponse.json(
        {
          error:
            "Could not publish as a news article. " +
            upsertError.message,
        },
        { status: 500 }
      );
    }

    const { error: updateError } = await adminSupabase
      .from("incident_candidates")
      .update({
        status: "converted_to_news",
        notes: "Published as an AI News article by admin.",
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        "News article created but candidate status update failed:",
        updateError
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Publish as news failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish as news.",
      },
      { status: 500 }
    );
  }
}
