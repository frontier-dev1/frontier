import { redirect } from "next/navigation";

import { createClient } from "../../../lib/supabase/server";

import NewsCandidatesDashboard from "../../components/NewsCandidatesDashboard";

export const dynamic = "force-dynamic";

export default async function NewsCandidatesPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const {
    data: admin,
  } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  const {
    data: candidates,
    error,
  } =
    await supabase
      .from(
        "ai_news_candidates"
      )
      .select("*")
      .order(
        "discovered_at",
        {
          ascending: false,
        }
      )
      .limit(100);

  if (error) {
    throw new Error(
      error.message
    );
  }

  return (
    <NewsCandidatesDashboard
      initialCandidates={
        candidates ?? []
      }
      userEmail={
        user.email ?? ""
      }
    />
  );
}