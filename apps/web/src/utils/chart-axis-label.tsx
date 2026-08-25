"use client";

import type { SVGProps } from "react";

type WrappedYAxisTickProps = SVGProps<SVGTextElement> & {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  /** Soft wrap length per line (by characters). */
  maxCharsPerLine?: number;
  /** Maximum number of lines before truncating with an ellipsis. */
  maxLines?: number;
};

function wrapLabel(raw: string, maxCharsPerLine: number, maxLines: number): string[] {
  const text = raw.trim();
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      pushCurrent();
      let rest = word;
      while (rest.length > maxCharsPerLine) {
        lines.push(rest.slice(0, maxCharsPerLine));
        rest = rest.slice(maxCharsPerLine);
        if (lines.length >= maxLines) break;
      }
      current = rest;
      if (lines.length >= maxLines) break;
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      pushCurrent();
      current = word;
    }

    if (lines.length >= maxLines) break;
  }
  pushCurrent();

  if (lines.length <= maxLines) return lines.length ? lines : [""];

  const clipped = lines.slice(0, maxLines);
  const last = clipped[maxLines - 1] ?? "";
  clipped[maxLines - 1] =
    last.length >= maxCharsPerLine
      ? `${last.slice(0, Math.max(1, maxCharsPerLine - 1))}…`
      : `${last}…`;
  return clipped;
}

/** Multi-line Y-axis tick for vertical Recharts bar charts with long category names. */
export function WrappedYAxisTick({
  x = 0,
  y = 0,
  payload,
  maxCharsPerLine = 16,
  maxLines = 3,
}: WrappedYAxisTickProps) {
  const value = payload?.value == null ? "" : String(payload.value);
  const lines = wrapLabel(value, maxCharsPerLine, maxLines);
  const lineHeight = 11;
  const offsetY = -((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      fill="#64748B"
      fontSize={10}
      textAnchor="end"
      dominantBaseline="middle"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? offsetY : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
