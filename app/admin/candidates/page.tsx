import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import CandidatesDashboard from "../../components/CandidatesDashboard";

export default async function CandidatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  const { data: candidates, error } = await supabase
    .from("incident_candidates")
    .select("*")
    .order("discovered_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <CandidatesDashboard
      initialCandidates={candidates ?? []}
      userEmail={user.email ?? ""}
    />
  );
}