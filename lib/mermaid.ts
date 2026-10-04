"use client";

import { useEffect, type RefObject } from "react";

// Same values as web's MermaidService (src/app/core/services/mermaid.service.ts),
// taken from the shared colour tokens: text on surface, teal lines.
export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "strict",
  themeVariables: {
    background: "#1a2329",
    mainBkg: "#1a2329",
    primaryColor: "#1a2329",
    primaryTextColor: "#f0f2f5",
    primaryBorderColor: "#20b2a6",
    secondaryColor: "#1a2329",
    tertiaryColor: "#1a2329",
    textColor: "#f0f2f5",
    nodeTextColor: "#f0f2f5",
    lineColor: "#20b2a6",
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
      figure.innerHTML = svg;
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
