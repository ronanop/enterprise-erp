import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Faithful port of the PWA icon set (apps/employee-app/src/components/icons.tsx).
 * Same 24x24 viewBox, strokeWidth 1.9, round caps/joins.
 */

export type IconProps = {
  size?: number;
  color?: string;
  filled?: boolean;
};

const STROKE = 1.9;

function useBase(size = 22, color = "currentColor") {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconHome({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5.5 9.5V20h13V9.5" />
      <Path d="M10 20v-6h4v6" />
    </Svg>
  );
}

export function IconCalendar({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="3" y="5" width="18" height="16" rx="2.5" />
      <Path d="M3 10h18" />
      <Path d="M8 3v4" />
      <Path d="M16 3v4" />
      <Path d="M8 14h.01" />
      <Path d="M12 14h.01" />
      <Path d="M16 14h.01" />
      <Path d="M16 14l2.5 2.5" />
    </Svg>
  );
}

export function IconClock({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconWallet({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <Path d="M2.5 10h19" />
      <Path d="M16 14.5h2.5" />
    </Svg>
  );
}

export function IconUser({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="12" cy="8" r="3.5" />
      <Path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" />
    </Svg>
  );
}

export function IconFingerprint({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 11a3 3 0 0 0-3 3v1" />
      <Path d="M12 8a6 6 0 0 0-6 6v1.5" />
      <Path d="M12 5a9 9 0 0 0-9 9" />
      <Path d="M12 11a3 3 0 0 1 3 3v4" />
      <Path d="M12 8a6 6 0 0 1 5.2 3" />
      <Path d="M15 18.5c.5 1 1.2 1.5 2 1.5a2.5 2.5 0 0 0 2.5-2.5V14" />
      <Path d="M9 17v1a3 3 0 0 1-3 3" />
    </Svg>
  );
}

export function IconPunch(props: IconProps) {
  return <IconFingerprint {...props} />;
}

export function IconBell({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <Path d="M4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.956-2.738 7.327A1 1 0 0 0 4 17z" />
    </Svg>
  );
}

export function IconSparkle({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 3l1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3z" />
      <Path d="M18.5 14.5l.6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4z" />
    </Svg>
  );
}

export function IconLocation({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function IconDownload({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 4v10" />
      <Path d="M8 10l4 4 4-4" />
      <Path d="M5 19h14" />
    </Svg>
  );
}

export function IconPlus({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

export function IconChevronRight({ size = 18, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconBack({ size = 18, color = "#0b1c30" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconCheck({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M5 12.5 9.5 17 19 7.5" />
    </Svg>
  );
}

export function IconAlert({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 4 3.5 19h17L12 4z" />
      <Path d="M12 10v4" />
      <Path d="M12 16h.01" />
    </Svg>
  );
}

export function IconHelp({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.5 9.5a2.8 2.8 0 0 1 5 1.7c0 1.8-2.5 2.2-2.5 3.8" />
      <Path d="M12 17h.01" />
    </Svg>
  );
}

export function IconLogout({ size = 22, color = "#ba1a1a" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
      <Path d="M14 8l4 4-4 4" />
      <Path d="M18 12H9" />
    </Svg>
  );
}

export function IconEye({ size = 22, color = "#434655" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff({ size = 22, color = "#434655" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M3 3l18 18" />
      <Path d="M10.5 10.5a3 3 0 0 0 4.2 4.2" />
      <Path d="M7 7.2C4.6 8.6 3 12 3 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />
      <Path d="M14 6.3A10.5 10.5 0 0 1 13 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" />
    </Svg>
  );
}

export function IconEdit({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M4 20h4l10-10-4-4L4 16v4z" />
      <Path d="M13 7l4 4" />
    </Svg>
  );
}

export function IconClose({ size = 22, color = "#0b1c30" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M6 6l12 12" />
      <Path d="M18 6 6 18" />
    </Svg>
  );
}

export function IconLogin({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H14" />
      <Path d="M10 8l-4 4 4 4" />
      <Path d="M6 12h9" />
    </Svg>
  );
}

export function IconSearch({ size = 18, color = "#737686" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconBrand({ size = 40 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id="brandGrad" x1="0" y1="0" x2="48" y2="48">
          <Stop offset="0" stopColor="#2563eb" />
          <Stop offset="1" stopColor="#712ae2" />
        </LinearGradient>
      </Defs>
      <Rect width="48" height="48" rx="14" fill="url(#brandGrad)" />
      <Circle cx="24" cy="18" r="6" stroke="#ffffff" strokeWidth="2.2" fill="none" />
      <Path
        d="M12 36c2.5-5 6.5-7.5 12-7.5S33.5 31 36 36"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
