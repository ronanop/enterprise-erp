"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  required?: boolean;
  hint?: string;
  /** Existing signature preview */
  valueDataUrl?: string | null;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
};

export function DigitalSignaturePad({
  label = "Digital signature",
  required,
  hint,
  valueDataUrl,
  disabled,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(valueDataUrl));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (valueDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasInk(true);
      };
      img.src = valueDataUrl;
    }
    // Only bootstrap once on mount / when value first appears empty→set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 cursor-pointer px-2 text-[11px]"
          disabled={disabled || !hasInk}
          onClick={clear}
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-dashed border-border bg-white",
          disabled && "opacity-60",
        )}
      >
        <canvas
          ref={canvasRef}
          className="h-36 w-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <PenLine className="size-3" />
        {hint || "Sign with mouse or finger. Signature is stamped on policies at submit."}
      </p>
    </div>
  );
}
