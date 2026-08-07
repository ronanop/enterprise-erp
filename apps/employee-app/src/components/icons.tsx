import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

function base({ size = 22, className, filled, ...props }: IconProps) {
  void filled;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
    ...props,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M16 14l2.5 2.5" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M16 14.5h2.5" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" />
    </svg>
  );
}

export function IconFingerprint(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 11a3 3 0 0 0-3 3v1" />
      <path d="M12 8a6 6 0 0 0-6 6v1.5" />
      <path d="M12 5a9 9 0 0 0-9 9" />
      <path d="M12 11a3 3 0 0 1 3 3v4" />
      <path d="M12 8a6 6 0 0 1 5.2 3" />
      <path d="M15 18.5c.5 1 1.2 1.5 2 1.5a2.5 2.5 0 0 0 2.5-2.5V14" />
      <path d="M9 17v1a3 3 0 0 1-3 3" />
    </svg>
  );
}

export function IconPunch(props: IconProps) {
  return <IconFingerprint {...props} />;
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.956-2.738 7.327A1 1 0 0 0 4 17z" />
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3z" />
      <path d="M18.5 14.5l.6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4z" />
    </svg>
  );
}

export function IconLocation(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props })}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props })}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 3.5 19h17L12 4z" />
      <path d="M12 10v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.8 2.8 0 0 1 5 1.7c0 1.8-2.5 2.2-2.5 3.8" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3l18 18" />
      <path d="M10.5 10.5a3 3 0 0 0 4.2 4.2" />
      <path d="M7 7.2C4.6 8.6 3 12 3 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />
      <path d="M14 6.3A10.5 10.5 0 0 1 13 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function IconLogin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H14" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9" />
    </svg>
  );
}

export function IconBrand(props: IconProps) {
  const size = props.size ?? 40;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={props.className}
    >
      <rect width="48" height="48" rx="14" fill="url(#brandGrad)" />
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#712ae2" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="18" r="6" stroke="white" strokeWidth="2.2" />
      <path
        d="M12 36c2.5-5 6.5-7.5 12-7.5S33.5 31 36 36"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
