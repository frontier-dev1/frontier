import { supabase } from "./supabase";

export async function getIncidents() {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("reported_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Failed to fetch incidents: ${error.message}`
    );
  }

  return data;
}

export async function getIncidentById(
  id: string
) {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return data;
}