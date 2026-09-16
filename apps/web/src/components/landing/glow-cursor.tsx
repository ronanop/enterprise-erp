"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

import "./glow-cursor.css";

const MAX_POINTS = 64;

const VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

#define MAX_POINTS 64

uniform vec2 uResolution;
uniform vec2 uPoints[MAX_POINTS];
uniform float uPointCount;
uniform vec3 uColor;
uniform vec3 uSecondaryColor;
uniform float uTrailWidth;
uniform float uTaper;
uniform float uGlowIntensity;
uniform float uGlowSpread;
uniform float uHotspot;
uniform float uBrightness;
uniform float uOpacity;
uniform float uPulseSpeed;
uniform float uNoiseStrength;
uniform float uNormalBlend;
uniform float uTime;
uniform float uFade;

varying vec2 vUv;

float sRGB(float x) {
  if (x <= 0.00031308) return 12.92 * x;
  return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float filmGrain(vec2 p, float time) {
  float frame = time * 18.0;
  float frameIndex = mod(floor(frame), 256.0);
  float nextFrameIndex = mod(frameIndex + 1.0, 256.0);
  float blend = fract(frame);
  blend = blend * blend * (3.0 - 2.0 * blend);
  vec2 pixel = floor(p);
  float current = hash(pixel + vec2(frameIndex * 17.0, frameIndex * 31.0));
  float next = hash(pixel + vec2(nextFrameIndex * 17.0, nextFrameIndex * 31.0));
  return mix(current, next, blend) * 2.0 - 1.0;
}

void main() {
  vec2 pixel = vUv * uResolution;
  float denominator = max(uPointCount - 1.0, 1.0);
  float strongest = 0.0;
  float strongestCore = 0.0;
  float colorWeight = 0.0;
  vec3 colorSum = vec3(0.0);

  for (int i = 0; i < MAX_POINTS - 1; i++) {
    float index = float(i);
    float active = 1.0 - step(uPointCount - 1.0, index);
    vec2 start = uPoints[i];
    vec2 end = uPoints[i + 1];
    vec2 toPixel = pixel - start;
    vec2 segment = end - start;
    float along = clamp(dot(toPixel, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
    float progress = clamp((index + along) / denominator, 0.0, 1.0);
    float life = pow(max(1.0 - progress, 0.0), mix(0.55, 1.25, uTaper));
    float width = uTrailWidth * mix(1.0, 0.25, pow(progress, mix(0.55, 1.6, uTaper)));
    float distanceToTrail = length(toPixel - segment * along);
    float falloff = max(width * (0.8 + uGlowSpread * 1.4), 0.5);
    float beam = min(1.0, (falloff * falloff) / (distanceToTrail * distanceToTrail + falloff * falloff));
    float core = exp(-pow(distanceToTrail / max(width, 0.5), 2.0) * 2.5);
    float pulseAmount = min(abs(uPulseSpeed), 1.0);
    float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.0 - progress * 11.0) * 0.16 * pulseAmount;
    float intensity = (core + beam * uGlowIntensity * 0.55) * life * pulse * active;
    vec3 segmentColor = mix(uColor, uSecondaryColor, progress);

    strongest = max(strongest, intensity);
    strongestCore = max(strongestCore, core * life * active);
    colorSum += segmentColor * intensity;
    colorWeight += intensity;
  }

  float grain = filmGrain(pixel, uTime);
  float noiseAmount = (1.0 - exp(-uNoiseStrength * 2.2)) * 0.4;
  float alpha = clamp(strongest * uOpacity * uFade, 0.0, 1.0);
  if (alpha < 0.0005) discard;

  vec3 color = colorSum / max(colorWeight, 0.0001);
  color = mix(color, vec3(1.0), smoothstep(0.25, 0.95, strongestCore) * uHotspot);
  float luminance = sRGB(clamp(strongest * uBrightness, 0.0, 1.0));
  luminance *= 1.0 + grain * noiseAmount;
  vec3 additiveColor = color * luminance;
  float normalAlpha = clamp(strongest * uBrightness * uOpacity * uFade, 0.0, 1.0);
  vec3 normalColor = mix(color, vec3(1.0), smoothstep(0.45, 1.0, strongestCore) * uHotspot * 0.35);
  gl_FragColor = vec4(mix(additiveColor, normalColor, uNormalBlend), mix(alpha, normalAlpha, uNormalBlend));
}
`;

function hexToRgb(hex: string): [number, number, number] {
  let value = (hex || "").replace("#", "").trim();
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const parsed = Number.parseInt(value || "000000", 16);
  return [
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255,
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function channelToLinear(channel: number) {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: [number, number, number]) {
  return (
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2])
  );
}

function parseCssColor(
  value: string,
): [number, number, number, number] | null {
  const color = value.trim().toLowerCase();
  if (!color || color === "transparent") return null;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) {
      raw = raw
        .split("")
        .map((char) => char + char)
        .join("");
    }
    if (raw.length === 6) raw += "ff";
    return [
      Number.parseInt(raw.slice(0, 2), 16) / 255,
      Number.parseInt(raw.slice(2, 4), 16) / 255,
      Number.parseInt(raw.slice(4, 6), 16) / 255,
      Number.parseInt(raw.slice(6, 8), 16) / 255,
    ];
  }

  const rgb = /^rgba?\((.+)\)$/i.exec(color);
  if (!rgb) return null;
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const toUnit = (part: string, index: number) => {
    if (part.endsWith("%")) {
      return clamp(Number.parseFloat(part) / 100, 0, 1);
    }
    const numeric = Number.parseFloat(part);
    if (Number.isNaN(numeric)) return 0;
    return index < 3 ? clamp(numeric / 255, 0, 1) : clamp(numeric, 0, 1);
  };
  return [
    toUnit(parts[0], 0),
    toUnit(parts[1], 1),
    toUnit(parts[2], 2),
    parts[3] !== undefined ? toUnit(parts[3], 3) : 1,
  ];
}

function darkenRgb(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    clamp(rgb[0] * (1 - amount * 0.35), 0, 1),
    clamp(rgb[1] * (1 - amount * 0.28), 0, 1),
    clamp(rgb[2] * (1 - amount * 0.18), 0, 1),
  ];
}

function sampleBackgroundLuma(
  clientX: number,
  clientY: number,
  ignoreRoot: HTMLElement,
): number {
  const stack = document.elementsFromPoint(clientX, clientY);
  let composite: [number, number, number] = [1, 1, 1];
  let remaining = 1;

  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    if (el === ignoreRoot || ignoreRoot.contains(el)) {
      if (el.tagName === "CANVAS" || el.classList.contains("glow-cursor__canvas")) {
        continue;
      }
      // Keep scanning through glow-cursor content so we see real page surfaces.
    }

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;

    const image = style.backgroundImage;
    if (image && image !== "none") {
      // Photos / gradients: treat as mid-dark so the trail stays readable.
      const assumed: [number, number, number] = [0.42, 0.45, 0.5];
      composite = mixRgb(composite, assumed, remaining * 0.85);
      remaining *= 0.15;
      if (remaining < 0.08) break;
      continue;
    }

    const parsed = parseCssColor(style.backgroundColor);
    if (!parsed || parsed[3] < 0.04) continue;

    const alpha = parsed[3] * remaining;
    composite = [
      mix(composite[0], parsed[0], alpha),
      mix(composite[1], parsed[1], alpha),
      mix(composite[2], parsed[2], alpha),
    ];
    remaining *= 1 - parsed[3];
    if (remaining < 0.08) break;
  }

  return relativeLuminance(composite);
}

type GlowCursorProps = {
  color?: string;
  secondaryColor?: string;
  trailLength?: number;
  trailWidth?: number;
  trailTaper?: number;
  followSpeed?: number;
  glowIntensity?: number;
  glowSpread?: number;
  hotspot?: number;
  brightness?: number;
  opacity?: number;
  pulseSpeed?: number;
  noiseStrength?: number;
  idleFade?: boolean;
  idleTimeout?: number;
  fadeDuration?: number;
  blendMode?: "normal" | "screen" | "plus-lighter";
  /** Auto-switch blend/colors when the surface under the cursor is light. */
  adaptToBackground?: boolean;
  maxDevicePixelRatio?: number;
  enabled?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type GlowConfig = {
  color: string;
  secondaryColor: string;
  trailLength: number;
  trailWidth: number;
  trailTaper: number;
  followSpeed: number;
  glowIntensity: number;
  glowSpread: number;
  hotspot: number;
  brightness: number;
  opacity: number;
  pulseSpeed: number;
  noiseStrength: number;
  idleFade: boolean;
  idleTimeout: number;
  fadeDuration: number;
  maxDevicePixelRatio: number;
  blendMode: GlowCursorProps["blendMode"];
  adaptToBackground: boolean;
  enabled: boolean;
};

export default function GlowCursor({
  color = "#67E8F9",
  secondaryColor = "#A78BFA",
  trailLength = 40,
  trailWidth = 8,
  trailTaper = 0.8,
  followSpeed = 0.16,
  glowIntensity = 1.9,
  glowSpread = 1.2,
  hotspot = 0.65,
  brightness = 1.25,
  opacity = 1,
  pulseSpeed = 1.1,
  noiseStrength = 0.035,
  idleFade = true,
  idleTimeout = 700,
  fadeDuration = 900,
  blendMode = "screen",
  adaptToBackground = true,
  maxDevicePixelRatio = 1.5,
  enabled = true,
  children,
  className = "",
  style,
  ...rest
}: GlowCursorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef<GlowConfig>({} as GlowConfig);

  propsRef.current = {
    color,
    secondaryColor,
    trailLength,
    trailWidth,
    trailTaper,
    followSpeed,
    glowIntensity,
    glowSpread,
    hotspot,
    brightness,
    opacity,
    pulseSpeed,
    noiseStrength,
    idleFade,
    idleTimeout,
    fadeDuration,
    maxDevicePixelRatio,
    blendMode,
    adaptToBackground,
    enabled,
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const initialConfig = propsRef.current;
    const renderer = new Renderer({
      canvas,
      alpha: true,
      dpr: Math.min(
        window.devicePixelRatio || 1,
        initialConfig.maxDevicePixelRatio,
      ),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const pointData = Array(MAX_POINTS * 2).fill(0);
    const points = Array.from({ length: MAX_POINTS }, () => ({ x: 0, y: 0 }));
    const target = { x: 0, y: 0 };
    const head = { x: 0, y: 0 };
    let pointerClient = { x: 0, y: 0 };
    let lightSurface = 0.85;
    let lastSampleTime = 0;

    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: [1, 1] },
        uPoints: { value: pointData },
        uPointCount: { value: initialConfig.trailLength },
        uColor: { value: hexToRgb(initialConfig.color) },
        uSecondaryColor: { value: hexToRgb(initialConfig.secondaryColor) },
        uTrailWidth: { value: initialConfig.trailWidth },
        uTaper: { value: initialConfig.trailTaper },
        uGlowIntensity: { value: initialConfig.glowIntensity },
        uGlowSpread: { value: initialConfig.glowSpread },
        uHotspot: { value: initialConfig.hotspot },
        uBrightness: { value: initialConfig.brightness },
        uOpacity: { value: initialConfig.opacity },
        uPulseSpeed: { value: initialConfig.pulseSpeed },
        uNoiseStrength: { value: initialConfig.noiseStrength },
        uNormalBlend: { value: initialConfig.blendMode === "normal" ? 1 : 0 },
        uTime: { value: 0 },
        uFade: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    let width = 1;
    let height = 1;
    let initialized = false;
    let pointerInside = false;
    let fade = 0;
    let lastInputTime = performance.now();
    let lastFrameTime = performance.now();
    let raf = 0;
    let destroyed = false;

    const resize = () => {
      width = Math.max(container.clientWidth, 1);
      height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };

    const initializeTrail = (x: number, y: number) => {
      target.x = x;
      target.y = y;
      head.x = x;
      head.y = y;
      for (const point of points) {
        point.x = x;
        point.y = y;
      }
      initialized = true;
      fade = 1;
    };

    const sampleSurface = (clientX: number, clientY: number, force = false) => {
      const config = propsRef.current;
      if (!config.adaptToBackground) {
        lightSurface = 0;
        return;
      }
      const now = performance.now();
      if (!force && now - lastSampleTime < 48) return;
      lastSampleTime = now;
      const luma = sampleBackgroundLuma(clientX, clientY, container);
      // Soft knee: start adapting above ~0.55 luminance, full by ~0.82.
      const targetLight = clamp((luma - 0.55) / 0.27, 0, 1);
      lightSurface += (targetLight - lightSurface) * 0.35;
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(rect.height - (event.clientY - rect.top), 0, rect.height);
      if (!initialized) initializeTrail(x, y);
      target.x = x;
      target.y = y;
      pointerClient = { x: event.clientX, y: event.clientY };
      pointerInside = true;
      lastInputTime = performance.now();
      sampleSurface(event.clientX, event.clientY);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      lastInputTime = performance.now();
    };

    const render = (now: number) => {
      if (destroyed) return;
      const config = propsRef.current;
      const delta = Math.min((now - lastFrameTime) / 16.667, 3);
      lastFrameTime = now;

      if (initialized) {
        const headEase =
          1 - Math.pow(1 - clamp(config.followSpeed, 0.01, 0.99), delta);
        const chainBase = clamp(0.28 + config.followSpeed * 0.35, 0.08, 0.92);
        const chainEase = 1 - Math.pow(1 - chainBase, delta);
        head.x += (target.x - head.x) * headEase;
        head.y += (target.y - head.y) * headEase;
        points[0].x = head.x;
        points[0].y = head.y;

        for (let i = 1; i < MAX_POINTS; i++) {
          points[i].x += (points[i - 1].x - points[i].x) * chainEase;
          points[i].y += (points[i - 1].y - points[i].y) * chainEase;
        }

        for (let i = 0; i < MAX_POINTS; i++) {
          pointData[i * 2] = points[i].x;
          pointData[i * 2 + 1] = points[i].y;
        }
      }

      if (config.adaptToBackground && pointerInside) {
        sampleSurface(pointerClient.x, pointerClient.y);
      } else if (!config.adaptToBackground) {
        lightSurface = 0;
      }

      const idleFor = now - lastInputTime;
      const shouldFade =
        config.idleFade && (!pointerInside || idleFor > config.idleTimeout);
      const fadeStep = (16.667 * delta) / Math.max(config.fadeDuration, 16);
      const fadeTarget = initialized && config.enabled && !shouldFade ? 1 : 0;
      fade += (fadeTarget - fade) * Math.min(1, fadeStep * 7);

      const light = config.adaptToBackground ? lightSurface : 0;
      const baseColor = hexToRgb(config.color);
      const baseSecondary = hexToRgb(config.secondaryColor);
      const adaptedColor = darkenRgb(baseColor, light * 0.55);
      const adaptedSecondary = darkenRgb(baseSecondary, light * 0.45);

      // Screen washes out on white; normal alpha keeps brand color readable.
      const preferNormal =
        config.blendMode === "normal" ? 1 : light * light * (3 - 2 * light);
      const cssBlend =
        preferNormal > 0.55
          ? "normal"
          : config.blendMode === "plus-lighter"
            ? "plus-lighter"
            : config.blendMode === "normal"
              ? "normal"
              : "screen";
      if (canvas.style.mixBlendMode !== cssBlend) {
        canvas.style.mixBlendMode = cssBlend;
      }

      program.uniforms.uPointCount.value = clamp(
        Math.round(config.trailLength),
        2,
        MAX_POINTS,
      );
      program.uniforms.uColor.value = adaptedColor;
      program.uniforms.uSecondaryColor.value = adaptedSecondary;
      program.uniforms.uTrailWidth.value = Math.max(
        config.trailWidth * mix(1, 1.15, light),
        0.1,
      );
      program.uniforms.uTaper.value = clamp(config.trailTaper, 0, 1);
      program.uniforms.uGlowIntensity.value = Math.max(
        config.glowIntensity * mix(1, 0.85, light),
        0,
      );
      program.uniforms.uGlowSpread.value = Math.max(
        config.glowSpread * mix(1, 0.9, light),
        0,
      );
      program.uniforms.uHotspot.value = clamp(
        config.hotspot * mix(1, 0.75, light),
        0,
        1,
      );
      program.uniforms.uBrightness.value = Math.max(
        config.brightness * mix(1, 0.92, light),
        0,
      );
      program.uniforms.uOpacity.value = clamp(
        config.opacity * mix(1, 1.2, light),
        0,
        1,
      );
      program.uniforms.uPulseSpeed.value = config.pulseSpeed;
      program.uniforms.uNoiseStrength.value = clamp(config.noiseStrength, 0, 1);
      program.uniforms.uNormalBlend.value = preferNormal;
      program.uniforms.uTime.value = now * 0.001;
      program.uniforms.uFade.value = fade;

      renderer.render({ scene: mesh });
      if (!destroyed) raf = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    container.addEventListener("pointermove", updatePointer);
    container.addEventListener("pointerenter", updatePointer);
    container.addEventListener("pointerleave", onPointerLeave);
    resize();
    // Default to light-surface look for this white landing until first sample.
    if (initialConfig.adaptToBackground) {
      lightSurface = 0.9;
      sampleSurface(
        window.innerWidth * 0.5,
        window.innerHeight * 0.35,
        true,
      );
    }
    raf = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", updatePointer);
      container.removeEventListener("pointerenter", updatePointer);
      container.removeEventListener("pointerleave", onPointerLeave);
      mesh.geometry.remove();
      program.remove();
    };
  }, [maxDevicePixelRatio]);

  return (
    <div
      ref={containerRef}
      className={`glow-cursor${className ? ` ${className}` : ""}`}
      style={style}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        className="glow-cursor__canvas"
        style={{ mixBlendMode: blendMode }}
        aria-hidden="true"
      />
      {children ? <div className="glow-cursor__content">{children}</div> : null}
    </div>
  );
}
