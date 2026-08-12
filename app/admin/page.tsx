import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import {AdminDashboard} from "../components/AdminDashboard";

export default async function AdminPage() {
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

  const { data: incidents, error } =
    await supabase
      .from("incidents")
      .select("*")
      .order("reported_at", {
        ascending: false,
      });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <AdminDashboard
      initialIncidents={incidents ?? []}
      userEmail={user.email ?? ""}
    />
  );
}