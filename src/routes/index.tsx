import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileStack, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loss Run Extractor — AI extraction, reconciliation, Excel export" },
      { name: "description", content: "Upload loss runs, extract fields with AI, reconcile data quality issues, and export a golden source Excel." },
      { property: "og:title", content: "Loss Run Extractor" },
      { property: "og:description", content: "AI-powered loss run extraction for every line of business." },
      { property: "og:type", content: "website" },
    ],
  }),
  ssr: false,
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="font-semibold">Loss Run Extractor</div>
        <div className="flex gap-2">
          {signedIn ? (
            <Link to="/dashboard"><Button>Open dashboard</Button></Link>
          ) : (
            <Link to="/auth"><Button>Sign in</Button></Link>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Turn messy loss runs into a golden source of truth.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          AI extraction across every line of business — PDF, Excel, CSV. Reconcile,
          flag data quality issues, and export a clean Excel your modelers, pricers,
          and risk analysts can actually use.
        </p>
        <div className="mt-8 flex gap-3">
          <Link to={signedIn ? "/dashboard" : "/auth"}><Button size="lg">Get started</Button></Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Feature icon={Zap} title="AI-native extraction" desc="Upload PDFs, spreadsheets, or CSVs — an agent drives what to pull." />
          <Feature icon={ShieldCheck} title="Reconciliation & quality flags" desc="Missing fields, negative reserves, regressions across periods." />
          <Feature icon={FileStack} title="Golden source agents" desc="Curate the fields your teams trust, then export the exact columns you need." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: any) {
  return (
    <div className="border rounded-lg p-5">
      <Icon className="h-5 w-5" />
      <div className="mt-3 font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
