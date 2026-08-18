import { NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
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
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const { data: admin, error: adminError } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) {
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

    const candidateId =
      (await context.params).id;

    const { error } =
      await supabase
        .from("incident_candidates")
        .delete()
        .eq("id", candidateId);

    if (error) {
      console.error(
        "Delete candidate error:",
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
    });
  } catch (error) {
    console.error(
      "Unexpected delete error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete candidate.",
      },
      {
        status: 500,
      }
    );
  }
}