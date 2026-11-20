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

export function IconHome({
  size = 22,
  color = "#004ac6",
  filled,
}: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 3.1 3.2 10.2A1.2 1.2 0 0 0 4 12.2h1.2V19a1.5 1.5 0 0 0 1.5 1.5H9.5a.75.75 0 0 0 .75-.75V14.5h3.5v5.25a.75.75 0 0 0 .75.75h2.8A1.5 1.5 0 0 0 18.8 19v-6.8H20a1.2 1.2 0 0 0 .8-2L12 3.1z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5.5 9.5V20h13V9.5" />
      <Path d="M10 20v-6h4v6" />
    </Svg>
  );
}

export function IconCalendar({
  size = 22,
  color = "#004ac6",
  filled,
}: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M7 3.25a.75.75 0 0 1 .75.75v.75h8.5V4a.75.75 0 0 1 1.5 0v.75H19a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2h1.25V4A.75.75 0 0 1 7 3.25zM5 9.5v9.5h14V9.5H5zm9.53 2.47a.75.75 0 0 1 0 1.06l-2.75 2.75a.75.75 0 0 1-1.06 0l-1.25-1.25a.75.75 0 1 1 1.06-1.06l.72.72 2.22-2.22a.75.75 0 0 1 1.06 0z" />
      </Svg>
    );
  }
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

export function IconWallet({
  size = 22,
  color = "#004ac6",
  filled,
}: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M4.5 6.25A2.25 2.25 0 0 0 2.25 8.5v9A2.25 2.25 0 0 0 4.5 19.75h15A2.25 2.25 0 0 0 21.75 17.5v-5.25H15.5a2.75 2.75 0 1 1 0-5.5h6.25V8.5A2.25 2.25 0 0 0 19.5 6.25h-15zM15.5 10.5a1.25 1.25 0 1 0 0 2.5h6.25v-2.5H15.5z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <Path d="M2.5 10h19" />
      <Path d="M16 14.5h2.5" />
    </Svg>
  );
}

export function IconUser({
  size = 22,
  color = "#004ac6",
  filled,
}: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Circle cx="12" cy="8" r="3.75" />
        <Path d="M5.2 19.8c1.7-3.4 4-4.9 6.8-4.9s5.1 1.5 6.8 4.9A11.2 11.2 0 0 0 12 18.2c-2.5 0-4.8.6-6.8 1.6z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="12" cy="8" r="3.5" />
      <Path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" />
    </Svg>
  );
}

export function IconFingerprint({
  size = 22,
  color = "#004ac6",
  filled,
}: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 3.25a8.75 8.75 0 0 0-8.75 8.75 1 1 0 1 0 2 0A6.75 6.75 0 0 1 12 5.25a6.75 6.75 0 0 1 6.55 5.15 1 1 0 1 0 1.94-.5A8.75 8.75 0 0 0 12 3.25zm0 3.5a5.25 5.25 0 0 0-5.25 5.25V14a1 1 0 1 0 2 0v-1.99A3.25 3.25 0 0 1 12 8.75a3.25 3.25 0 0 1 3.25 3.25v5.5a1 1 0 1 0 2 0v-5.5A5.25 5.25 0 0 0 12 6.75zm0 3.5a1.75 1.75 0 0 0-1.75 1.75v1.5a1 1 0 1 0 2 0v-1.5c0-.14.11-.25.25-.25h.01A1 1 0 0 0 12 10.25zm-4.5 6.25a1 1 0 0 0-1 1 3.5 3.5 0 0 0 3.5 3.5 1 1 0 1 0 0-2A1.5 1.5 0 0 1 8.5 17.5a1 1 0 0 0-1-1zm8.75 0a1 1 0 0 0-1 1V19a1.5 1.5 0 0 1-1.5 1.5 1 1 0 1 0 0 2A3.5 3.5 0 0 0 18.25 19v-1.75a1 1 0 0 0-1-1z" />
      </Svg>
    );
  }
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

export function IconDoorExit({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M4 4.5h9.5A1.5 1.5 0 0 1 15 6v12a1.5 1.5 0 0 1-1.5 1.5H4" />
      <Path d="M4 4.5v15" />
      <Path d="M11 12h.01" />
      <Path d="M17 8l4 4-4 4" />
      <Path d="M21 12h-7" />
    </Svg>
  );
}

export function IconLaptop({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="4" y="5" width="16" height="11" rx="1.8" />
      <Path d="M2.5 19h19" />
      <Path d="M9 19h6" />
    </Svg>
  );
}

export function IconBank({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M3 10.5 12 4l9 6.5" />
      <Path d="M5 10.5V18" />
      <Path d="M9.5 10.5V18" />
      <Path d="M14.5 10.5V18" />
      <Path d="M19 10.5V18" />
      <Path d="M3.5 18h17" />
      <Path d="M2.5 21h19" />
    </Svg>
  );
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

function solidBase(size = 22, color = "#004ac6") {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: color,
  };
}

/** Conference table + display — Meeting Rooms quick action */
export function IconMeetingRoom({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M4.5 4.2h15a1.3 1.3 0 0 1 1.3 1.3v5.2H3.2V5.5A1.3 1.3 0 0 1 4.5 4.2z" />
        <Path d="M3.2 12.2h17.6v1.6a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2v-1.6z" />
        <Path d="M7.2 15.2h1.8v3.2H7.2z" />
        <Path d="M15 15.2h1.8v3.2H15z" />
        <Path d="M5.4 19.2h4.2v1.2H5.4z" />
        <Path d="M14.4 19.2h4.2v1.2h-4.2z" />
        <Path d="M11.1 15.2h1.8v4H11.1z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="5" y="3.5" width="14" height="8" rx="1.6" />
      <Path d="M10 11.5h4v1.2h-4z" />
      <Path d="M4.5 15.2h15" />
      <Path d="M7 15.2v4" />
      <Path d="M17 15.2v4" />
      <Path d="M12 15.2v4" />
    </Svg>
  );
}

export function IconDocument({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M6 2.75A1.75 1.75 0 0 0 4.25 4.5v15A1.75 1.75 0 0 0 6 21.25h12A1.75 1.75 0 0 0 19.75 19.5V9.25L13.5 2.75H6zm7.5 0.9v4.6c0 .69.56 1.25 1.25 1.25h4.35L13.5 3.65z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <Path d="M14 3.5V8h4.5" />
      <Path d="M8.5 12h7" />
      <Path d="M8.5 16h5" />
    </Svg>
  );
}

export function IconPolicy({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M6.6 4.6c0-.9.7-1.6 1.6-1.6h1.15A2 2 0 0 1 11.2 1.7h1.6a2 2 0 0 1 1.85 1.3H16.8c.9 0 1.6.7 1.6 1.6v14.7c0 .9-.7 1.6-1.6 1.6H8.2c-.9 0-1.6-.7-1.6-1.6V4.6z" />
        <Rect x="10.1" y="2.15" width="3.8" height="2.2" rx="0.7" fill={color} />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="6" y="4.5" width="12" height="16" rx="2" />
      <Path d="M9.5 4.5V3.75A1.25 1.25 0 0 1 10.75 2.5h2.5A1.25 1.25 0 0 1 14.5 3.75V4.5" />
      <Path d="M8.75 12.25 10.75 14.25 15.25 9.5" />
    </Svg>
  );
}

export function IconBriefcase({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M9.5 3.5A2 2 0 0 0 7.5 5.5V7H5a2.5 2.5 0 0 0-2.5 2.5V11h19V9.5A2.5 2.5 0 0 0 19 7h-2.5V5.5a2 2 0 0 0-2-2h-5zM9 5.5h6V7H9V5.5zM2.5 12.5V18A2.5 2.5 0 0 0 5 20.5h14a2.5 2.5 0 0 0 2.5-2.5v-5.5h-19z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="3" y="7" width="18" height="13" rx="2" />
      <Path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <Path d="M3 12h18" />
    </Svg>
  );
}

export function IconHouse({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M11.3 2.6a1.1 1.1 0 0 1 1.4 0l8.2 7.1c.5.4.2 1.3-.5 1.3H19v8.25A1.75 1.75 0 0 1 17.25 21h-3.5v-5.25a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75V21h-3.5A1.75 1.75 0 0 1 5 19.25V11H3.6c-.7 0-1-.9-.5-1.3l8.2-7.1z" />
      </Svg>
    );
  }
  return <IconHome size={size} color={color} />;
}

export function IconLayers({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Path d="M12.45 2.7a1 1 0 0 0-.9 0L3.1 7.2a1 1 0 0 0 0 1.75l8.45 4.55a1 1 0 0 0 .9 0l8.45-4.55a1 1 0 0 0 0-1.75L12.45 2.7z" />
        <Path d="M3.1 12.05a1 1 0 0 0 0 1.75l8.45 4.55a1 1 0 0 0 .9 0l8.45-4.55a1 1 0 0 0 0-1.75l-1.1-.6-6.9 3.72a1.75 1.75 0 0 1-1.6 0L4.2 11.45l-1.1.6z" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5z" />
      <Path d="M3.5 12.5 12 17l8.5-4.5" />
      <Path d="M3.5 16.5 12 21l8.5-4.5" />
    </Svg>
  );
}

export function IconSun({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="12" cy="12" r="3.5" />
      <Path d="M12 3.5v2" />
      <Path d="M12 18.5v2" />
      <Path d="M3.5 12h2" />
      <Path d="M18.5 12h2" />
      <Path d="M6.2 6.2l1.4 1.4" />
      <Path d="M16.4 16.4l1.4 1.4" />
      <Path d="M6.2 17.8l1.4-1.4" />
      <Path d="M16.4 7.6l1.4-1.4" />
    </Svg>
  );
}

export function IconPlane({ size = 22, color = "#004ac6", filled }: IconProps) {
  void filled;
  return (
    <Svg {...useBase(size, color)}>
      <Path d="M10.5 19.5 13 13l6.5-1.5L21 10l-6.5 1L12 4.5 10.5 5.5 12 11 6.5 12.5 5 11 3.5 11.5 5.5 14.5 3.5 16 5 16.5 6.5 15 10.5 19.5z" />
    </Svg>
  );
}

export function IconGrid({ size = 22, color = "#004ac6", filled }: IconProps) {
  if (filled) {
    return (
      <Svg {...solidBase(size, color)}>
        <Rect x="3" y="3" width="8" height="8" rx="2" />
        <Rect x="13" y="3" width="8" height="8" rx="2" />
        <Rect x="3" y="13" width="8" height="8" rx="2" />
        <Rect x="13" y="13" width="8" height="8" rx="2" />
      </Svg>
    );
  }
  return (
    <Svg {...useBase(size, color)}>
      <Rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <Rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function IconUsers({ size = 22, color = "#004ac6" }: IconProps) {
  return (
    <Svg {...useBase(size, color)}>
      <Circle cx="9" cy="8" r="3" />
      <Path d="M3.5 19c1.4-2.6 3.3-3.8 5.5-3.8S13.1 16.4 14.5 19" />
      <Circle cx="17" cy="9" r="2.4" />
      <Path d="M15.2 19c.7-1.5 1.8-2.4 3.3-2.7" />
    </Svg>
  );
}
