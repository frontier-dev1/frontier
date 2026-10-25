import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}));

    const {
      title,
      article_url,
      source_name,
      summary,
      published_at,
    }: {
      title?: string;
      article_url?: string;
      source_name?: string;
      summary?: string;
      published_at?: string;
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    if (!article_url || !article_url.trim()) {
      return NextResponse.json(
        { error: "Article URL is required." },
        { status: 400 }
      );
    }

    let normalizedUrl: string;

    try {
      normalizedUrl = new URL(article_url.trim()).toString();
    } catch {
      return NextResponse.json(
        { error: "That doesn't look like a valid URL." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: existing } = await adminSupabase
      .from("incident_candidates")
      .select("id, status")
      .eq("article_url", normalizedUrl)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `This URL is already a candidate (status: ${existing.status}).`,
        },
        { status: 409 }
      );
    }

    const derivedSourceName =
      source_name?.trim() ||
      (() => {
        try {
          return new URL(normalizedUrl).hostname.replace(
            /^www\./,
            ""
          );
        } catch {
          return "Unknown";
        }
      })();

    const now = new Date().toISOString();

    const { data: candidate, error: insertError } =
      await adminSupabase
        .from("incident_candidates")
        .insert({
          id: crypto.randomUUID(),
          title: title.trim(),
          source_url: normalizedUrl,
          article_url: normalizedUrl,
          source_name: derivedSourceName,
          summary: summary?.trim() || null,
          published_at: published_at || null,
          discovered_at: now,
          status: "pending",
          relevance_score: 100,
          matched_keywords: ["manually added"],
          notes: `Manually added by ${user.email ?? "an admin"} — not found by the discovery engine.`,
          article_text: null,
          article_text_source: null,
          article_text_fetched_at: null,
          article_text_length: 0,
          article_fetch_status: "pending",
        })
        .select("*")
        .single();

    if (insertError) {
      console.error(
        "Failed to create manual candidate:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Could not create the candidate. " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      candidate,
    });
  } catch (error) {
    console.error(
      "Manual candidate creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create candidate.",
      },
      { status: 500 }
    );
  }
}
