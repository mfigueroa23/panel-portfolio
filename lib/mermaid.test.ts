import { act, render } from "@testing-library/react";
import { createElement, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MERMAID_CONFIG, renderMermaidIn, useMermaid } from "./mermaid";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (id: string, source: string) => ({
    svg: `<svg id="${id}" data-source="${source.length}"></svg>`,
  })),
}));
vi.mock("mermaid", () => ({ default: mermaid }));

// The API's output for a ```mermaid fence (plan §2 B).
function figure(source: string): string {
  return `<figure class="md-mermaid"><pre class="mermaid-source"><code>${source}</code></pre></figure>`;
}

describe("MERMAID_CONFIG", () => {
  // Same values as web's MermaidService, so preview and site draw alike.
  it("pins the base theme, strict security and the palette's colours", () => {
    expect(MERMAID_CONFIG).toEqual({
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
    });
  });
});

describe("renderMermaidIn", () => {
  beforeEach(() => {
    mermaid.initialize.mockClear();
    mermaid.render.mockClear();
  });

  it("does nothing when there is no diagram", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<p>No diagrams</p>";
    await renderMermaidIn(host);
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("replaces each diagram's source with the rendered SVG", async () => {
    const host = document.createElement("div");
    host.innerHTML = figure("flowchart LR\n  a --&gt; b") + figure("graph TD; x");
    await renderMermaidIn(host);
    expect(mermaid.initialize).toHaveBeenCalledWith(MERMAID_CONFIG);
    expect(mermaid.render.mock.calls.map(([, source]) => source)).toEqual([
      "flowchart LR\n  a --> b",
      "graph TD; x",
    ]);
    expect(host.querySelectorAll(".md-mermaid .md-mermaid-diagram svg")).toHaveLength(2);
    expect(host.querySelector(".mermaid-source")).toBeNull();
  });

  // As on the site: a wide diagram keeps its width and scrolls inside its block.
  it("keeps each diagram at its natural width", async () => {
    mermaid.render.mockResolvedValueOnce({
      svg: '<svg id="wide" style="max-width: 1200px;"></svg>',
    });
    const host = document.createElement("div");
    host.innerHTML = figure("graph LR; a");
    await renderMermaidIn(host);
    expect(host.querySelector<SVGElement>("svg")!.style.minWidth).toBe("1200px");
  });

  it("keeps the source and adds a note when a diagram cannot be parsed", async () => {
    mermaid.render.mockRejectedValueOnce(new Error("Parse error"));
    const host = document.createElement("div");
    host.innerHTML = figure("not a diagram");
    await renderMermaidIn(host);
    expect(host.querySelector(".mermaid-source")!.textContent).toBe("not a diagram");
    expect(host.querySelector(".md-mermaid-error")!.textContent).toBe(
      "Diagram could not be rendered.",
    );
  });
});

describe("useMermaid", () => {
  function Preview({ html }: { html: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useMermaid(ref, html);
    return createElement("div", { ref, dangerouslySetInnerHTML: { __html: html } });
  }

  it("renders the diagrams of the element after each content change", async () => {
    mermaid.render.mockClear();
    const { rerender, container } = render(createElement(Preview, { html: figure("graph TD; a") }));
    await act(async () => {});
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(createElement(Preview, { html: figure("graph TD; b") }));
    await act(async () => {});
    expect(mermaid.render).toHaveBeenCalledTimes(2);
  });
});
