import type { ReactNode } from "react";

/** Wrap a category label into multiple lines for Recharts Y-axis ticks. */
export function wrapChartAxisLabel(
  label: string,
  maxCharsPerLine = 18,
  maxLines = 3,
): string[] {
  const text = label.trim();
  if (!text) return [""];
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushHardBroken = (token: string) => {
    let rest = token;
    while (rest.length > maxCharsPerLine && lines.length < maxLines - 1) {
      lines.push(rest.slice(0, maxCharsPerLine));
      rest = rest.slice(maxCharsPerLine);
    }
    current = rest;
  };

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (lines.length >= maxLines) break;
    if (word.length > maxCharsPerLine) {
      pushHardBroken(word);
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length >= maxCharsPerLine
        ? `${last.slice(0, maxCharsPerLine - 1)}…`
        : `${last}…`;
  }

  return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)];
}

type WrappedYAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  maxCharsPerLine?: number;
  maxLines?: number;
  fill?: string;
  fontSize?: number;
  fontWeight?: number | string;
};

/** Multi-line end-anchored tick for vertical bar chart category axis. */
export function WrappedYAxisTick({
  x = 0,
  y = 0,
  payload,
  maxCharsPerLine = 18,
  maxLines = 3,
  fill = "#334155",
  fontSize = 11,
  fontWeight = 500,
}: WrappedYAxisTickProps): ReactNode {
  const lines = wrapChartAxisLabel(String(payload?.value ?? ""), maxCharsPerLine, maxLines);
  const mid = (lines.length - 1) / 2;
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={`${line}-${index}`}
          x={0}
          y={0}
          dy={`${(index - mid) * 1.15}em`}
          textAnchor="end"
          fill={fill}
          fontSize={fontSize}
          fontWeight={fontWeight}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
