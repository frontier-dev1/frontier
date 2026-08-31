import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: admin,
    } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Administrator access required.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      id,
    } = await context.params;

    const adminSupabase =
      createAdminClient();

    const {
      data: candidate,
      error: candidateError,
    } =
      await adminSupabase
        .from("ai_news_candidates")
        .update({
          status:
            "rejected",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

    if (
      candidateError ||
      !candidate
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to reject news candidate.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      candidate,
    });
  } catch (error) {
    console.error(
      "News rejection failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reject candidate.",
      },
      {
        status: 500,
      }
    );
  }
}