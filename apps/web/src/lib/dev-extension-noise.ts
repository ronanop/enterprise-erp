type ErpWindow = Window & {
  __erpDevExtNoiseFilter?: boolean;
};

type WrappedConsole = Console["error"] & { __erpWrapped?: boolean };

const NOISE_RE =
  /Content already injected|Injection error|runInjection|Crypto site not identified|reading 'location'|sendHistory|keyboard-shortcuts|site-signal\.top|api\/finish|superior-grabber|mimi\.saghirmohamed19|Access-Control-Allow-Origin|Failed to fetch/i;

function isExtNoise(text: unknown) {
  return NOISE_RE.test(String(text || ""));
}

function isExtensionEvent(e: ErrorEvent) {
  const fn = e.filename;
  if (fn && (fn.includes("chrome-extension") || fn.includes("moz-extension"))) {
    return true;
  }
  const blob = [e.message, e.error?.message, fn].join(" ");
  if (!isExtNoise(blob)) return false;
  // Extension throws often surface as "reading 'location'" via Next chunks — still noise.
  if (/reading 'location'/i.test(blob)) return true;
  if (!fn) return true;
  if (fn.includes("/_next/") || fn.includes("webpack")) return false;
  return true;
}

function filterArgs(args: IArguments | unknown[]) {
  let text = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as { message?: string } | unknown;
    if (a && typeof a === "object" && "message" in a && a.message) {
      text += ` ${a.message}`;
    } else {
      text += `${i ? " " : ""}${String(a)}`;
    }
  }
  return isExtNoise(text);
}

function wrapConsole(method: "error" | "warn") {
  const orig = console[method] as WrappedConsole;
  if (!orig || orig.__erpWrapped) return;
  const wrapped: WrappedConsole = function (...args: unknown[]) {
    if (filterArgs(args)) return;
    return orig.apply(console, args as []);
  };
  wrapped.__erpWrapped = true;
  console[method] = wrapped;
}

/** Install browser-extension console noise filters (dev only; call from client after mount). */
export function installDevExtensionNoiseFilter() {
  if (typeof window === "undefined") return;
  const w = window as ErpWindow;
  if (w.__erpDevExtNoiseFilter) return;
  w.__erpDevExtNoiseFilter = true;

  wrapConsole("error");
  wrapConsole("warn");

  window.addEventListener(
    "error",
    (e) => {
      if (!isExtensionEvent(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const text =
      reason && typeof reason === "object" && "message" in reason
        ? String((reason as { message?: unknown }).message ?? "")
        : String(reason || "");
    if (!isExtNoise(text)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  });
}
