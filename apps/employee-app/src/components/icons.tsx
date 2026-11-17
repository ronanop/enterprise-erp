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

function solidBase({ size = 22, className, filled, ...props }: IconProps) {
  void filled;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    stroke: "none",
    className,
    "aria-hidden": true as const,
    ...props,
  };
}

export function IconHome(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M12 3.1 3.2 10.2A1.2 1.2 0 0 0 4 12.2h1.2V19a1.5 1.5 0 0 0 1.5 1.5H9.5a.75.75 0 0 0 .75-.75V14.5h3.5v5.25a.75.75 0 0 0 .75.75h2.8A1.5 1.5 0 0 0 18.8 19v-6.8H20a1.2 1.2 0 0 0 .8-2L12 3.1z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M7 3.25a.75.75 0 0 1 .75.75v.75h8.5V4a.75.75 0 0 1 1.5 0v.75H19a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2h1.25V4A.75.75 0 0 1 7 3.25zM5 9.5v9.5h14V9.5H5zm9.53 2.47a.75.75 0 0 1 0 1.06l-2.75 2.75a.75.75 0 0 1-1.06 0l-1.25-1.25a.75.75 0 1 1 1.06-1.06l.72.72 2.22-2.22a.75.75 0 0 1 1.06 0z" />
      </svg>
    );
  }
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
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.75 3.75a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6z"
        />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconWallet(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M4.5 6.25A2.25 2.25 0 0 0 2.25 8.5v9A2.25 2.25 0 0 0 4.5 19.75h15A2.25 2.25 0 0 0 21.75 17.5v-5.25H15.5a2.75 2.75 0 1 1 0-5.5h6.25V8.5A2.25 2.25 0 0 0 19.5 6.25h-15zM15.5 10.5a1.25 1.25 0 1 0 0 2.5h6.25v-2.5H15.5z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M16 14.5h2.5" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  const { filled, size = 22, className, ...rest } = props;
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className={className}
        {...rest}
      >
        <circle cx="12" cy="8" r="3.75" />
        <path d="M5.2 19.8c1.7-3.4 4-4.9 6.8-4.9s5.1 1.5 6.8 4.9A11.2 11.2 0 0 0 12 18.2c-2.5 0-4.8.6-6.8 1.6z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" />
    </svg>
  );
}

/** Manager: silhouette with a small star badge (profile summary grid). */
export function IconManager(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="7.5" r="3" />
      <path d="M3.5 19c1.5-2.8 3.5-4 6.5-4s5 1.2 6.5 4" />
      <path
        d="M17.5 4.2l.7 1.5 1.6.2-1.2 1.1.4 1.6-1.5-.8-1.5.8.4-1.6-1.2-1.1 1.6-.2.7-1.5z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Door / exit — offboarding list item. */
export function IconDoorExit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4.5h9.5A1.5 1.5 0 0 1 15 6v12a1.5 1.5 0 0 1-1.5 1.5H4" />
      <path d="M4 4.5v15" />
      <path d="M11 12h.01" />
      <path d="M17 8l4 4-4 4" />
      <path d="M21 12h-7" />
    </svg>
  );
}

export function IconFingerprint(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M12 3.25a8.75 8.75 0 0 0-8.75 8.75 1 1 0 1 0 2 0A6.75 6.75 0 0 1 12 5.25a6.75 6.75 0 0 1 6.55 5.15 1 1 0 1 0 1.94-.5A8.75 8.75 0 0 0 12 3.25zm0 3.5a5.25 5.25 0 0 0-5.25 5.25V14a1 1 0 1 0 2 0v-1.99A3.25 3.25 0 0 1 12 8.75a3.25 3.25 0 0 1 3.25 3.25v5.5a1 1 0 1 0 2 0v-5.5A5.25 5.25 0 0 0 12 6.75zm0 3.5a1.75 1.75 0 0 0-1.75 1.75v1.5a1 1 0 1 0 2 0v-1.5c0-.14.11-.25.25-.25h.01A1 1 0 0 0 12 10.25zm-4.5 6.25a1 1 0 0 0-1 1 3.5 3.5 0 0 0 3.5 3.5 1 1 0 1 0 0-2A1.5 1.5 0 0 1 8.5 17.5a1 1 0 0 0-1-1zm8.75 0a1 1 0 0 0-1 1V19a1.5 1.5 0 0 1-1.5 1.5 1 1 0 1 0 0 2A3.5 3.5 0 0 0 18.25 19v-1.75a1 1 0 0 0-1-1z" />
      </svg>
    );
  }
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
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M12 2.5c-4.05 0-7.25 3.12-7.25 7.1 0 4.72 5.55 10.3 6.8 11.5a.7.7 0 0 0 .9 0c1.25-1.2 6.8-6.78 6.8-11.5 0-3.98-3.2-7.1-7.25-7.1zm0 9.6a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
      </svg>
    );
  }
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

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5 12 13l8.5-5.5" />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5h3.2l1.2 4.2-2 1.2a12 12 0 0 0 5.7 5.7l1.2-2 4.2 1.2V17a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 7.2 2 2 0 0 1 6 5h2z" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20h16" />
      <path d="M6 20V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V20" />
      <path d="M9 9h.01" />
      <path d="M12 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 13h.01" />
      <path d="M12 13h.01" />
      <path d="M15 13h.01" />
      <path d="M10 20v-3h4v3" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c1.4-2.6 3.3-3.8 5.5-3.8S13.1 16.4 14.5 19" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.2 19c.7-1.5 1.8-2.4 3.3-2.7" />
    </svg>
  );
}

export function IconDocument(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6 2.75A1.75 1.75 0 0 0 4.25 4.5v15A1.75 1.75 0 0 0 6 21.25h12A1.75 1.75 0 0 0 19.75 19.5V9.25L13.5 2.75H6zm7.5 0.9v4.6c0 .69.56 1.25 1.25 1.25h4.35L13.5 3.65zM8 12.25a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5H8zm0 3.5a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5H8z"
        />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h5" />
    </svg>
  );
}

export function IconLaptop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="11" rx="1.8" />
      <path d="M2.5 19h19" />
      <path d="M9 19h6" />
    </svg>
  );
}

export function IconBank(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 10.5V18" />
      <path d="M9.5 10.5V18" />
      <path d="M14.5 10.5V18" />
      <path d="M19 10.5V18" />
      <path d="M3.5 18h17" />
      <path d="M2.5 21h19" />
    </svg>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5L6 9H5a2 2 0 0 0-2 2z" />
      <path d="M14.5 8.5c1.2.8 2 2.1 2 3.5s-.8 2.7-2 3.5" />
      <path d="M17.5 6.5c2 1.4 3.2 3.5 3.2 5.5s-1.2 4.1-3.2 5.5" />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.5 7.5 0 0 0 0-2l-1.9-.3a5.7 5.7 0 0 0-.5-1.2l1.1-1.6a7.6 7.6 0 0 0-1.4-1.4l-1.6 1.1a5.7 5.7 0 0 0-1.2-.5L13.6 4.6a7.5 7.5 0 0 0-2 0l-.3 1.9a5.7 5.7 0 0 0-1.2.5L8.5 5.9a7.6 7.6 0 0 0-1.4 1.4l1.1 1.6a5.7 5.7 0 0 0-.5 1.2L5.6 11a7.5 7.5 0 0 0 0 2l1.9.3c.1.42.28.82.5 1.2l-1.1 1.6a7.6 7.6 0 0 0 1.4 1.4l1.6-1.1c.38.22.78.4 1.2.5l.3 1.9a7.5 7.5 0 0 0 2 0l.3-1.9c.42-.1.82-.28 1.2-.5l1.6 1.1a7.6 7.6 0 0 0 1.4-1.4l-1.1-1.6c.22-.38.4-.78.5-1.2l1.9-.3z" />
    </svg>
  );
}

export function IconMoreVertical(props: IconProps) {
  const size = props.size ?? 22;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={props.className}
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconBriefcase(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M9.5 3.5A2 2 0 0 0 7.5 5.5V7H5a2.5 2.5 0 0 0-2.5 2.5V11h19V9.5A2.5 2.5 0 0 0 19 7h-2.5V5.5a2 2 0 0 0-2-2h-5zM9 5.5h6V7H9V5.5zM2.5 12.5V18A2.5 2.5 0 0 0 5 20.5h14a2.5 2.5 0 0 0 2.5-2.5v-5.5h-19z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function IconHouse(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M11.3 2.6a1.1 1.1 0 0 1 1.4 0l8.2 7.1c.5.4.2 1.3-.5 1.3H19v8.25A1.75 1.75 0 0 1 17.25 21h-3.5v-5.25a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75V21h-3.5A1.75 1.75 0 0 1 5 19.25V11H3.6c-.7 0-1-.9-.5-1.3l8.2-7.1z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function IconHeadset(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12a7.5 7.5 0 0 1 15 0" />
      <path d="M4.5 12v4.5A1.5 1.5 0 0 0 6 18h1.5v-6H6A1.5 1.5 0 0 0 4.5 12z" />
      <path d="M19.5 12v4.5A1.5 1.5 0 0 1 18 18h-1.5v-6H18a1.5 1.5 0 0 1 1.5 1.5z" />
      <path d="M16.5 18.5c0 1.5-1.5 2.5-4.5 2.5" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <path d="M12.45 2.7a1 1 0 0 0-.9 0L3.1 7.2a1 1 0 0 0 0 1.75l8.45 4.55a1 1 0 0 0 .9 0l8.45-4.55a1 1 0 0 0 0-1.75L12.45 2.7z" />
        <path d="M3.1 12.05a1 1 0 0 0 0 1.75l8.45 4.55a1 1 0 0 0 .9 0l8.45-4.55a1 1 0 0 0 0-1.75l-1.1-.6-6.9 3.72a1.75 1.75 0 0 1-1.6 0L4.2 11.45l-1.1.6z" />
        <path d="M3.1 16.3a1 1 0 0 0 0 1.75l8.45 4.55a1 1 0 0 0 .9 0l8.45-4.55a1 1 0 0 0 0-1.75l-1.1-.6-6.9 3.72a1.75 1.75 0 0 1-1.6 0L4.2 15.7l-1.1.6z" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
      <path d="M3.5 16.5 12 21l8.5-4.5" />
    </svg>
  );
}

export function IconQrScan(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <rect x="7" y="7" width="4.5" height="4.5" rx="0.8" />
      <rect x="12.5" y="7" width="4.5" height="4.5" rx="0.8" />
      <rect x="7" y="12.5" width="4.5" height="4.5" rx="0.8" />
      <path d="M12.5 12.5h2" />
      <path d="M16.5 12.5v2" />
      <path d="M12.5 17h4.5" />
      <path d="M15 14.5h1.5" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2" />
      <path d="M12 18.5v2" />
      <path d="M3.5 12h2" />
      <path d="M18.5 12h2" />
      <path d="M6.2 6.2l1.4 1.4" />
      <path d="M16.4 16.4l1.4 1.4" />
      <path d="M6.2 17.8l1.4-1.4" />
      <path d="M16.4 7.6l1.4-1.4" />
    </svg>
  );
}

export function IconPlane(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.5 19.5 13 13l6.5-1.5L21 10l-6.5 1L12 4.5 10.5 5.5 12 11 6.5 12.5 5 11 3.5 11.5 5.5 14.5 3.5 16 5 16.5 6.5 15 10.5 19.5z" />
    </svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 2.5 5.5 13.5h6L9.5 21.5 19 10h-6L16.5 2.5H13z" />
    </svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...solidBase(props)}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 5.5v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

export function IconMobile(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 17.5h2" />
    </svg>
  );
}

export function IconCacheMark(props: IconProps) {
  const size = props.size ?? 36;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={props.className}
    >
      <path
        d="M20 2.5 34.5 11v18L20 37.5 5.5 29V11L20 2.5z"
        fill="url(#cacheMarkGrad)"
      />
      <defs>
        <linearGradient id="cacheMarkGrad" x1="6" y1="4" x2="34" y2="36">
          <stop stopColor="#7c5cfc" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <path
        d="M13.5 20.2c0-3.5 2.7-6.2 6.5-6.2 2.6 0 4.7 1.1 5.8 2.9l-2.4 1.5c-.7-1.1-1.9-1.8-3.4-1.8-2.1 0-3.6 1.6-3.6 3.6s1.5 3.6 3.6 3.6c1.5 0 2.7-.7 3.4-1.8l2.4 1.5c-1.1 1.8-3.2 2.9-5.8 2.9-3.8 0-6.5-2.7-6.5-6.2z"
        fill="white"
      />
    </svg>
  );
}
