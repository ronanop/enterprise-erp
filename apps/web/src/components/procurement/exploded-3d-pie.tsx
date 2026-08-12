"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useId, useMemo, useState, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

export type Exploded3dPieSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
  /** Darker edge for 3D thickness. */
  edgeColor?: string;
};
type PreparedSlice = Exploded3dPieSlice & {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  pct: number;
};

type HoverTip = {
  key: string;
  label: string;
  pct: number;
  color: string;
  x: number;
  y: number;
};

function darkenHex(hex: string, amount = 0.28): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const n = Number.parseInt(raw, 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function polar(cx: number, cy: number, rx: number, ry: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(rad),
    y: cy + ry * Math.sin(rad),
  };
}

function prepareSlices(slices: Exploded3dPieSlice[]): PreparedSlice[] {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  if (total <= 0) return [];
  let cursor = -20;
  return slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 360;
      const startAngle = cursor;
      const endAngle = cursor + sweep;
      const midAngle = startAngle + sweep / 2;
      cursor = endAngle;
      return {
        ...s,
        edgeColor: s.edgeColor ?? darkenHex(s.color),
        startAngle,
        endAngle,
        midAngle,
        pct: (s.value / total) * 100,
      };
    });
}

function SlicePaths({
  slice,
  cx,
  cy,
  rx,
  ry,
  depth,
  explode,
  onHover,
  onLeave,
}: {
  slice: PreparedSlice;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  depth: number;
  explode: number;
  onHover: (event: MouseEvent<SVGGElement>, slice: PreparedSlice) => void;
  onLeave: () => void;
}) {
  const rad = ((slice.midAngle - 90) * Math.PI) / 180;
  const ox = Math.cos(rad) * explode;
  const oy = Math.sin(rad) * explode * 0.55;
  const scx = cx + ox;
  const scy = cy + oy;

  const topStart = polar(scx, scy, rx, ry, slice.startAngle);
  const topEnd = polar(scx, scy, rx, ry, slice.endAngle);
  const large = slice.endAngle - slice.startAngle > 180 ? 1 : 0;

  const topPath = [
    `M ${scx} ${scy}`,
    `L ${topStart.x} ${topStart.y}`,
    `A ${rx} ${ry} 0 ${large} 1 ${topEnd.x} ${topEnd.y}`,
    "Z",
  ].join(" ");

  const wallStart = polar(scx, scy + depth, rx, ry, slice.startAngle);
  const wallEnd = polar(scx, scy + depth, rx, ry, slice.endAngle);
  const wallPath = [
    `M ${topStart.x} ${topStart.y}`,
    `A ${rx} ${ry} 0 ${large} 1 ${topEnd.x} ${topEnd.y}`,
    `L ${wallEnd.x} ${wallEnd.y}`,
    `A ${rx} ${ry} 0 ${large} 0 ${wallStart.x} ${wallStart.y}`,
    "Z",
  ].join(" ");

  const faceA = [
    `M ${scx} ${scy}`,
    `L ${topStart.x} ${topStart.y}`,
    `L ${wallStart.x} ${wallStart.y}`,
    `L ${scx} ${scy + depth}`,
    "Z",
  ].join(" ");
  const faceB = [
    `M ${scx} ${scy}`,
    `L ${topEnd.x} ${topEnd.y}`,
    `L ${wallEnd.x} ${wallEnd.y}`,
    `L ${scx} ${scy + depth}`,
    "Z",
  ].join(" ");

  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(event) => onHover(event, slice)}
      onMouseMove={(event) => onHover(event, slice)}
      onMouseLeave={onLeave}
    >
      <path d={wallPath} fill={slice.edgeColor} />
      <path d={faceA} fill={slice.edgeColor} opacity={0.92} />
      <path d={faceB} fill={slice.edgeColor} opacity={0.85} />
      <path d={topPath} fill={slice.color} stroke="#fff" strokeWidth={0.6} />
      <title>
        {slice.label}: {slice.pct.toFixed(1)}%
      </title>
    </g>
  );
}

export function Exploded3dPieChart({
  slices,
  className,
  ariaLabel,
  size = 168,
  layout = "horizontal",
}: {
  slices: Exploded3dPieSlice[];
  className?: string;
  ariaLabel: string;
  size?: number;
  layout?: "horizontal" | "compact";
}) {
  const uid = useId();
  const [tip, setTip] = useState<HoverTip | null>(null);
  const prepared = useMemo(() => prepareSlices(slices), [slices]);
  const total = prepared.reduce((sum, s) => sum + s.value, 0);

  if (prepared.length === 0 || total <= 0) return null;

  const width = size * 1.15;
  const height = size * 0.92;
  const cx = width * 0.52;
  const cy = height * 0.42;
  const rx = size * 0.34;
  const ry = size * 0.22;
  const depth = size * 0.08;
  const explode = size * 0.045;

  const ordered = [...prepared].sort((a, b) => {
    const ay = Math.sin(((a.midAngle - 90) * Math.PI) / 180);
    const by = Math.sin(((b.midAngle - 90) * Math.PI) / 180);
    return ay - by;
  });

  function onHover(event: MouseEvent<SVGGElement>, slice: PreparedSlice) {
    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTip({
      key: slice.key,
      label: slice.label,
      pct: slice.pct,
      color: slice.color,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  const legend = (
    <ul
      className={cn(
        "min-w-0 space-y-1 text-[11px]",
        layout === "compact" ? "grid w-full grid-cols-1 gap-1" : "flex-1 space-y-1.5",
      )}
    >
      {prepared.map((slice) => (
        <li key={slice.key} className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: slice.color }}
            aria-hidden
          />
          <span className="min-w-0 truncate font-normal text-foreground">
            {slice.label}: {slice.value.toLocaleString("en-IN")}
          </span>
          {slice.href ? (
            <Link
              href={slice.href}
              onClick={(event) => event.stopPropagation()}
              className="ml-auto inline-flex shrink-0 cursor-pointer items-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
              aria-label={`Open ${slice.label}`}
            >
              <ExternalLink className="size-3 opacity-70" aria-hidden />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );

  const chartSvg = (
    <div className="relative shrink-0">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        <defs>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.18" />
          </filter>
        </defs>
        <g filter={`url(#${uid}-soft)`}>
          {ordered.map((slice) => (
            <SlicePaths
              key={slice.key}
              slice={slice}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              depth={depth}
              explode={explode}
              onHover={onHover}
              onLeave={() => setTip(null)}
            />
          ))}
        </g>
      </svg>
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] rounded-md border border-border/80 bg-card px-2 py-1 text-[11px] shadow-md"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="font-normal text-muted-foreground">{tip.label}</p>
          <p className="font-semibold tabular-nums" style={{ color: tip.color }}>
            {tip.pct.toFixed(1)}%
          </p>
        </div>
      ) : null}
    </div>
  );

  if (layout === "compact") {
    return (
      <div className={cn("flex min-w-0 flex-col items-center gap-3", className)}>
        {chartSvg}
        {legend}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-4", className)}>
      {legend}
      {chartSvg}
    </div>
  );
}
