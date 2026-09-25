"use client";
// Presenter shortcuts (demo mode only): /demo?preset=fresh|sent|simulated|escalation
// Jumps straight to a known state — useful for rehearsals and mid-demo recovery.
import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoMode } from "@/components/Providers";
import { Loading } from "@/components/ui";
import { markSent } from "@/lib/caseOps";
import { simulatePlatformResponses } from "@/lib/demo";
import { createDemoCase } from "@/lib/seed";
import { setCase } from "@/lib/useCase";

const PRESETS = {
  fresh: { path: "/case", build: () => createDemoCase() },
  sent: {
    path: "/case/tracker",
    build: () => {
      const c = createDemoCase();
      return markSent(c, c.requests.map((r) => r.id), new Date().toISOString(), true);
    },
  },
  simulated: { path: "/case/tracker", build: () => simulatePlatformResponses(createDemoCase(), Date.now()) },
  escalation: { path: "/case/ftc", build: () => simulatePlatformResponses(createDemoCase(), Date.now()) },
} as const;

function Apply() {
  const demo = useDemoMode();
  const params = useSearchParams();
  const router = useRouter();
  const done = useRef(false);
  const preset = PRESETS[(params.get("preset") ?? "fresh") as keyof typeof PRESETS] ?? PRESETS.fresh;

  useEffect(() => {
    if (!demo || done.current) return;
    done.current = true;
    setCase(preset.build());
    router.replace(preset.path);
  }, [demo, preset, router]);

  if (!demo) return <p className="mx-auto max-w-md px-4 py-16 text-muted">Demo mode is off.</p>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Loading />
    </div>
  );
}

export default function DemoPresets() {
  return (
    <Suspense>
      <Apply />
    </Suspense>
  );
}
