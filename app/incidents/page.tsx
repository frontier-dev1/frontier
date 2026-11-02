// app/incidents/page.tsx
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { IncidentsClient } from "./IncidentsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Incidents | Frontier",
  description: "Explore significant incidents involving AI systems going rogue.",
};

export default async function IncidentsPage() {
  const supabase = await createClient();
  
  // Sort by occurred_at descending (most recent first)
  const { data: incidents } = await supabase
    .from("incidents")
    .select("*")
    .order("occurred_at", { ascending: false, nullsFirst: false });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Rogue AI Agents / Models Database</h1>
          <p className="text-muted-foreground mt-1">
            Browse interactive incident cards or isolate specific datasets to export in CSV/PDF.
          </p>
        </div>
        <IncidentsClient initialIncidents={incidents || []} />
      </main>
      <SiteFooter />
    </div>
  );
}