import type { Metadata } from "next";
import { ResumeManager } from "@/components/resume/resume-manager";

export const metadata: Metadata = { title: "Resume · Portfolio Panel" };

// A static segment, so the [collection] route never receives "resume". The
// manager reads the session token from SessionProvider in the admin layout.
export default function ResumePage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground">Resume</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          One PDF from Files per language. English is required; Spanish falls back to it.
        </p>
      </header>
      <ResumeManager />
    </section>
  );
}
