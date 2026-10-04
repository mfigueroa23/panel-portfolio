import type { Metadata } from "next";
import { FileLibrary } from "@/components/files/file-library";

export const metadata: Metadata = { title: "Files · Portfolio Panel" };

// A static segment, so the [collection] route never receives "files". The
// library reads the session token from SessionProvider in the admin layout.
export default function FilesPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <FileLibrary
        heading={
          <>
            <h1 className="text-3xl font-semibold text-foreground">Files</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Images up to 5 MiB (PNG, JPEG, WebP, GIF, SVG) · PDF up to 10 MiB
            </p>
          </>
        }
      />
    </section>
  );
}
