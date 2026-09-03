import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

export const metadata = {
  title: "About | Frontier",
  description:
    "Learn about Frontier, a database tracking significant AI incidents and unexpected AI behavior.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050B18] text-white">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center lg:px-8 lg:pb-28 lg:pt-32">
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            About Frontier
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Understanding what happens when AI
            <span className="text-blue-400">
              {" "}
              goes beyond its intended boundaries.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-400">
            Frontier is an independent database of significant AI
            incidents. We track cases where AI systems demonstrate
            unexpected, unauthorized, deceptive, unsafe, or otherwise
            consequential behavior.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              The mission
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Make AI incidents easier to understand.
            </h2>
          </div>

          <div className="space-y-5 text-base leading-7 text-slate-400">
            <p>
              AI systems are becoming increasingly capable and
              increasingly autonomous. As that happens, incidents
              involving unexpected model behavior are becoming an
              important source of information about the limits and
              risks of these systems.
            </p>

            <p>
              Information about those incidents, however, is often
              scattered across news articles, research papers,
              company reports, security disclosures, and other
              sources.
            </p>

            <p>
              Frontier brings these reports together into a structured
              record so that researchers, developers, policymakers,
              and anyone interested in AI safety can more easily
              understand what happened and identify broader patterns.
            </p>
          </div>
        </div>
      </section>

      {/* What we track */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              What we track
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              More than just “rogue AI.”
            </h2>

            <p className="mt-5 leading-7 text-slate-400">
              Frontier focuses on meaningful instances of AI behavior
              that depart from expectations or create consequential
              outcomes.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AboutCard
              number="01"
              title="Autonomous behavior"
              description="AI systems taking actions with limited or unexpected human direction."
            />

            <AboutCard
              number="02"
              title="Unauthorized actions"
              description="Systems accessing, modifying, or interacting with resources beyond their intended scope."
            />

            <AboutCard
              number="03"
              title="Deception & manipulation"
              description="Cases involving deceptive behavior, strategic misrepresentation, or manipulation."
            />

            <AboutCard
              number="04"
              title="Security incidents"
              description="AI systems involved in breaches, exploitation, cyberattacks, or security failures."
            />

            <AboutCard
              number="05"
              title="Safety failures"
              description="Behavior that creates meaningful safety risks or violates established safeguards."
            />

            <AboutCard
              number="06"
              title="Unexpected behavior"
              description="Other significant cases where an AI system behaves materially differently than intended."
            />
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8 lg:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            Methodology
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            From discovery to verification.
          </h2>

          <div className="mt-12 space-y-10">
            <MethodStep
              number="01"
              title="Discovery"
              description="Frontier continuously searches public reporting and other sources for potentially significant AI incidents."
            />

            <MethodStep
              number="02"
              title="Assessment"
              description="Potential incidents are analyzed against the available evidence to determine whether the reported behavior represents a meaningful departure from intended behavior."
            />

            <MethodStep
              number="03"
              title="Editorial review"
              description="Candidates are reviewed before publication. AI-assisted analysis helps organize evidence and surface important details, while publication remains subject to human review."
            />

            <MethodStep
              number="04"
              title="Publication"
              description="Verified incidents are added to the public database with structured information about the system, organization, behavior, severity, and supporting sources."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-4xl px-6 py-24 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore the incidents.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-slate-400">
            Browse the database and see how AI incidents are evolving
            across models, organizations, and categories.
          </p>

          <Link
            href="/incidents"
            className="mt-8 inline-flex items-center rounded-xl bg-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
          >
            Explore incidents →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function AboutCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-blue-400/30 hover:bg-blue-400/[0.04]">
      <div className="text-xs font-bold tracking-[0.2em] text-blue-400">
        {number}
      </div>

      <h3 className="mt-5 text-lg font-bold text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function MethodStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-4 border-b border-white/10 pb-10 last:border-0 last:pb-0 sm:grid-cols-[80px_180px_1fr]">
      <div className="text-sm font-bold text-blue-400">
        {number}
      </div>

      <h3 className="font-bold text-white">
        {title}
      </h3>

      <p className="text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}