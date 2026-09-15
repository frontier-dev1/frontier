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

    const body = await request.json().catch(() => ({}));

    const {
      severity,
      description,
      company,
    }: {
      severity?: string;
      description?: string;
      company?: string;
    } = body;

    if (!severity) {
      return NextResponse.json(
        {
          error:
            "Severity is required to publish an incident (this article has no AI-assigned severity, since news review doesn't score severity).",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: candidate, error: candidateError } =
      await adminSupabase
        .from("ai_news_candidates")
        .select("*")
        .eq("id", id)
        .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "News candidate not found." },
        { status: 404 }
      );
    }

    const finalCompany =
      company || candidate.ai_company;

    const finalSummary =
      candidate.ai_summary || candidate.summary;

    const finalDescription =
      description || finalSummary;

    if (!finalCompany) {
      return NextResponse.json(
        {
          error:
            "No company on this article — pass one in explicitly to publish it as an incident.",
        },
        { status: 400 }
      );
    }

    if (!finalSummary || !finalDescription) {
      return NextResponse.json(
        {
          error:
            "This article has no summary to publish as an incident description.",
        },
        { status: 400 }
      );
    }

    const incidentId = crypto.randomUUID();

    const { error: insertError } = await adminSupabase
      .from("incidents")
      .insert({
        id: incidentId,
        title:
          candidate.ai_title || candidate.title,
        company: finalCompany,
        model: candidate.ai_model,
        severity,
        category: candidate.ai_category,
        occurred_at: candidate.published_at,
        summary: finalSummary,
        description: finalDescription,
        source_name:
          candidate.source_name || "Unknown",
        source_url:
          candidate.article_url ||
          candidate.source_url,
        verification_status: "unverified",
      });

    if (insertError) {
      console.error(
        "Failed to publish news candidate as incident:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Could not create the incident. " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    const { error: updateError } = await adminSupabase
      .from("ai_news_candidates")
      .update({
        status: "converted_to_incident",
        ai_reasoning: `Published as incident ${incidentId} by admin.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        "Incident created but candidate status update failed:",
        updateError
      );
    }

    return NextResponse.json({
      success: true,
      incident_id: incidentId,
    });
  } catch (error) {
    console.error(
      "Publish as incident failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish as incident.",
      },
      { status: 500 }
    );
  }
}
