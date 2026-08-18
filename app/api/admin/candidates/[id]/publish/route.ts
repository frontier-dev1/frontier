import { NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";

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

    // ----------------------------------------------------------
    // Verify authentication
    // ----------------------------------------------------------

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    // ----------------------------------------------------------
    // Verify admin access
    // ----------------------------------------------------------

    const { data: admin, error: adminError } =
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
          error: "Unable to verify administrator access.",
        },
        {
          status: 500,
        }
      );
    }

    if (!admin) {
      return NextResponse.json(
        {
          error: "Administrator access required.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------------------------
    // Parse request
    // ----------------------------------------------------------

    const body = await request.json();

    const {
      title,
      company,
      model,
      severity,
      category,
      occurredAt,
      summary,
      description,
    } = body;

    // ----------------------------------------------------------
    // Publish through the atomic database function
    // ----------------------------------------------------------

    const { data, error } = await supabase.rpc(
      "publish_incident_candidate",
      {
        p_candidate_id: (
          await context.params
        ).id,
        p_title: title,
        p_company: company,
        p_model: model || null,
        p_severity: severity,
        p_category: category || null,
        p_occurred_at:
          occurredAt || null,
        p_summary: summary,
        p_description: description,
      }
    );

    if (error) {
      console.error(
        "Publish candidate error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      incident: data,
    });
  } catch (error) {
    console.error(
      "Unexpected publish error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish candidate.",
      },
      {
        status: 500,
      }
    );
  }
}