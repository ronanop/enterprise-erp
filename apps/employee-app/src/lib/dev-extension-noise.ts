/**
 * Browser extensions inject scripts into every page (history:27, keyboard-shortcuts.js,
 * site-signal.top, etc.). Next.js 16 devtools treats their console.error as app errors.
 * Injected in <head> in development only (see root layout).
 */
export const DEV_EXTENSION_NOISE_SCRIPT = `
(function () {
  if (typeof window === "undefined") return;
  if (window.__erpDevExtNoiseFilter) return;
  window.__erpDevExtNoiseFilter = true;
  var RE =
    /Content already injected|Injection error|runInjection|Crypto site not identified|reading 'location'|sendHistory|keyboard-shortcuts|site-signal\\.top|api\\/finish|superior-grabber/i;
  function isExtNoise(text) {
    return RE.test(String(text || ""));
  }
  function isExtensionEvent(e) {
    var fn = e && e.filename;
    if (fn && (fn.indexOf("chrome-extension") !== -1 || fn.indexOf("moz-extension") !== -1)) {
      return true;
    }
    var blob = [e && e.message, e && e.error && e.error.message, fn].join(" ");
    if (!isExtNoise(blob)) return false;
    if (/reading 'location'/i.test(blob)) return true;
    if (!fn) return true;
    if (fn.indexOf("/_next/") !== -1 || fn.indexOf("webpack") !== -1) return false;
    return true;
  }
  function filterArgs(args) {
    var text = "";
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a && typeof a === "object" && a.message) text += " " + a.message;
      else text += (i ? " " : "") + a;
    }
    return isExtNoise(text);
  }
  function wrapConsole(method) {
    var orig = console[method];
    if (!orig || orig.__erpWrapped) return;
    console[method] = function () {
      if (filterArgs(arguments)) return;
      return orig.apply(console, arguments);
    };
    console[method].__erpWrapped = true;
  }
  wrapConsole("error");
  wrapConsole("warn");
  window.addEventListener(
    "error",
    function (e) {
      if (!isExtensionEvent(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    },
    true
  );
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    var text =
      reason && typeof reason === "object" && reason.message
        ? reason.message
        : String(reason || "");
    if (!isExtNoise(text)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  });
})();
`;
