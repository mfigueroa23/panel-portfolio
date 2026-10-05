"use client";

import { useEffect, type RefObject } from "react";

// Copy of web's MERMAID_CONFIG (src/app/core/services/mermaid.service.ts), so a
// post's diagrams look the same in the preview and on the site: text on the
// surface colour, teal lines.
export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "strict",
  fontFamily: "Inter, sans-serif",
  themeVariables: {
    darkMode: true,
    background: "#1a2329",
    primaryColor: "#1a2329",
    primaryTextColor: "#f0f2f5",
    primaryBorderColor: "#20b2a6",
    secondaryColor: "#1f2830",
    secondaryTextColor: "#f0f2f5",
    tertiaryColor: "#141a1f",
    tertiaryTextColor: "#f0f2f5",
    textColor: "#f0f2f5",
    lineColor: "#20b2a6",
    noteBkgColor: "#1f2830",
    noteTextColor: "#f0f2f5",
  },
} as const;

export const DIAGRAM_ERROR = "Diagram could not be rendered.";

type Mermaid = typeof import("mermaid").default;

let loading: Promise<Mermaid> | null = null;
let counter = 0;

// Mermaid is large, so it is loaded only when a preview has a diagram.
function loadMermaid(): Promise<Mermaid> {
  loading ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize(MERMAID_CONFIG);
    return mermaid;
  });
  return loading;
}

/** Draws every `.mermaid-source` block the API left inside `host`. */
export async function renderMermaidIn(host: HTMLElement): Promise<void> {
  const sources = Array.from(host.querySelectorAll<HTMLElement>(".mermaid-source"));
  if (sources.length === 0) return;
  const mermaid = await loadMermaid();
  for (const source of sources) {
    const figure = source.closest(".md-mermaid") ?? source.parentElement;
    if (!figure) continue;
    const id = `mermaid-preview-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, source.textContent ?? "");
      const diagram = document.createElement("div");
      diagram.className = "md-mermaid-diagram";
      diagram.innerHTML = svg;
      // As on the site: a wide diagram keeps its natural width and scrolls
      // inside its block instead of shrinking to unreadable text.
      const element = diagram.querySelector("svg");
      if (element?.style.maxWidth) element.style.minWidth = element.style.maxWidth;
      figure.replaceChildren(diagram);
    } catch {
      // Mermaid can leave its scratch element behind when parsing fails.
      document.getElementById(`d${id}`)?.remove();
      if (!figure.querySelector(".md-mermaid-error")) {
        const note = document.createElement("p");
        note.className = "md-mermaid-error";
        note.textContent = DIAGRAM_ERROR;
        figure.appendChild(note);
      }
    }
  }
}

/** Renders the diagrams inside `ref` whenever `content` changes. */
export function useMermaid(ref: RefObject<HTMLElement | null>, content: string): void {
  useEffect(() => {
    if (ref.current) void renderMermaidIn(ref.current);
  }, [ref, content]);
}
