/**
 * Vanilla port of Framer Fullscreen Scroll Slider
 * https://framer.com/m/Full-screen-silder-zZCwXG.js@Fq0uLJvAPftZDdZMcAb8
 *
 * No GSAP/ScrollTrigger — keeps Framer's Solution text-fill reveal working.
 */
(function (global) {
  const IMG = "/site/stock/";

  const DEFAULT_SLIDES = [
    {
      image: IMG + "erp-01-finance.jpg",
      title: "Finance - GL, journals, and close in one controlled ledger.",
    },
    {
      image: IMG + "erp-02-dashboard.jpg",
      title: "Dashboards - live KPIs for ops, not vanity charts.",
    },
    {
      image: IMG + "erp-03-workflow.jpg",
      title: "Workflows - approvals and alerts land with the right owner.",
    },
    {
      image: IMG + "erp-04-ops.jpg",
      title: "CRM, GRC, and HR share one identity, workflow, and audit trail.",
    },
    {
      image: IMG + "erp-05-platform.jpg",
      title: "Connect Plus - AI-powered ERP apps, module by module.",
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mount(target, options) {
    if (!target || target.dataset.icpFsMounted) return;
    target.dataset.icpFsMounted = "1";

    const cfg = Object.assign(
      {
        slides: DEFAULT_SLIDES,
        // Intro kept; outro removed (was the centered "connects finance…" block)
        introText:
          "Track what counts - monitoring, insights, and automated reports so you grow the business.",
        showIntro: true,
        showOutro: false,
        navLabel: "",
        showIndices: true,
        vhPerSlide: 100,
        overlayOpacity: 0.35,
        accentColor: "#ffffff",
        backgroundColor: "#0f0f0f",
        textColor: "#ffffff",
      },
      options || {}
    );

    const slides = cfg.slides.filter((s) => s && s.image && s.title);
    if (!slides.length) return;

    target.innerHTML = "";
    target.style.cssText =
      "position:relative;width:100%;background:" +
      cfg.backgroundColor +
      ";color:" +
      cfg.textColor +
      ";font-family:Inter,system-ui,sans-serif;overflow:visible;";

    const root = document.createElement("div");
    root.className = "icp-fs-root";
    target.appendChild(root);

    if (cfg.showIntro) {
      const intro = document.createElement("section");
      intro.className = "icp-fs-intro";
      intro.style.cssText =
        "position:relative;width:100%;height:100vh;height:100dvh;display:grid;place-items:center;background:" +
        cfg.backgroundColor +
        ";color:" +
        cfg.textColor +
        ";padding:clamp(1.25rem,4vw,2rem);box-sizing:border-box;";
      intro.innerHTML =
        '<h1 class="icp-fs-intro-title" style="width:min(92%,36rem);text-align:center;margin:0 auto;font-size:clamp(1.45rem,5.5vw,3rem);font-weight:600;letter-spacing:-0.04em;line-height:1.2;">' +
        escapeHtml(cfg.introText) +
        "</h1>";
      root.appendChild(intro);
    }

    const track = document.createElement("div");
    track.className = "icp-fs-track";
    const trackH = slides.length * cfg.vhPerSlide;
    track.style.cssText =
      "position:relative;width:100%;height:" + trackH + "vh;min-height:" + trackH + "vh;";

    // Keeps scroll distance even when the slider is position:fixed
    const spacer = document.createElement("div");
    spacer.className = "icp-fs-spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = "width:100%;height:" + trackH + "vh;pointer-events:none;";
    track.appendChild(spacer);

    const sliderSection = document.createElement("section");
    sliderSection.className = "icp-fs-slider";
    // Absolute inside track; JS pins to viewport (CSS sticky fails under Framer overflow:clip)
    sliderSection.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#000;z-index:2;";
    sliderSection.innerHTML =
      '<div class="icp-fs-images" style="position:absolute;inset:0;z-index:0;"></div>' +
      '<div style="position:absolute;inset:0;z-index:1;background:rgba(0,0,0,' +
      cfg.overlayOpacity +
      ');pointer-events:none;"></div>' +
      '<div class="icp-fs-chrome" style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:space-between;padding:1.25rem 1.25rem 14vh 1.25rem;box-sizing:border-box;pointer-events:none;">' +
      '<div style="display:flex;justify-content:flex-end;align-items:flex-start;gap:1rem;">' +
      (cfg.navLabel
        ? '<p style="margin:0;font-size:0.75rem;letter-spacing:0.08em;opacity:0.7;">' +
          escapeHtml(cfg.navLabel) +
          "</p>"
        : "<div></div>") +
      (cfg.showIndices
        ? '<div class="icp-fs-indices" style="display:flex;flex-direction:column;gap:0.55rem;align-items:flex-end;"></div>'
        : "<div></div>") +
      "</div>" +
      '<div class="icp-fs-title" style="width:min(92%,40rem);max-width:100%;"></div>' +
      "</div>" +
      '<div class="icp-fs-rail" style="position:absolute;top:0;right:0;width:1px;height:100%;background:rgba(255,255,255,0.35);z-index:3;">' +
      '<div class="icp-fs-progress" style="position:absolute;top:0;left:50%;width:3px;height:100%;background:' +
      cfg.accentColor +
      ';transform-origin:top;transform:translateX(-50%) scaleY(0);"></div></div>';

    track.appendChild(sliderSection);
    root.appendChild(track);

    const imagesWrap = sliderSection.querySelector(".icp-fs-images");
    const titleWrap = sliderSection.querySelector(".icp-fs-title");
    const indicesWrap = sliderSection.querySelector(".icp-fs-indices");
    const progressEl = sliderSection.querySelector(".icp-fs-progress");

    let activeSlide = -1;
    let ticking = false;

    if (indicesWrap) {
      slides.forEach((_, index) => {
        const num = (index + 1).toString().padStart(2, "0");
        const el = document.createElement("p");
        el.style.cssText =
          "display:flex;align-items:center;gap:0.75rem;margin:0;font-size:0.75rem;letter-spacing:0.05em;";
        el.innerHTML =
          '<span class="fs-marker" style="display:inline-block;width:0.75rem;height:1px;background:' +
          cfg.accentColor +
          ';transform-origin:right;transform:scaleX(0);transition:transform 0.3s ease;"></span><span class="fs-index" style="opacity:0.35;color:' +
          cfg.textColor +
          ';transition:opacity 0.3s ease;">' +
          num +
          "</span>";
        indicesWrap.appendChild(el);
      });
    }

    function animateIndicators(index) {
      if (!indicesWrap) return;
      indicesWrap.querySelectorAll("p").forEach((item, i) => {
        const marker = item.querySelector(".fs-marker");
        const idxEl = item.querySelector(".fs-index");
        if (idxEl) idxEl.style.setProperty("opacity", i === index ? "1" : "0.35", "important");
        if (marker) marker.style.transform = "scaleX(" + (i === index ? 1 : 0) + ")";
      });
    }

    function animateNewTitle(index) {
      titleWrap.innerHTML = "";
      const h1 = document.createElement("h1");
      h1.style.cssText =
        "margin:0;color:" +
        cfg.textColor +
        ";font-size:clamp(1.35rem,5.2vw,3rem);font-weight:700;letter-spacing:-0.04em;line-height:1.15;";
      const words = String(slides[index].title).split(" ");
      words.forEach((word, i) => {
        const mask = document.createElement("span");
        mask.style.cssText = "display:inline-block;overflow:hidden;vertical-align:top;";
        const inner = document.createElement("span");
        inner.style.cssText =
          "display:inline-block;transform:translateY(100%);opacity:0;transition:transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease;";
        inner.style.transitionDelay = i * 0.02 + "s";
        inner.textContent = word + (i < words.length - 1 ? "\u00a0" : "");
        mask.appendChild(inner);
        h1.appendChild(mask);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            inner.style.transform = "translateY(0)";
            inner.style.opacity = "1";
          });
        });
      });
      titleWrap.appendChild(h1);
    }

    function animateNewSlide(index) {
      if (index === activeSlide) return;
      activeSlide = index;
      const img = document.createElement("img");
      img.src = slides[index].image;
      img.alt = "Slide " + (index + 1);
      img.decoding = "async";
      img.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.1);opacity:0;transition:opacity 0.5s ease, transform 1s ease;";
      imagesWrap.appendChild(img);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          img.style.opacity = "1";
          img.style.transform = "scale(1)";
        });
      });
      const allImages = imagesWrap.querySelectorAll("img");
      if (allImages.length > 3) {
        const removeCount = allImages.length - 3;
        for (let i = 0; i < removeCount; i++) imagesWrap.removeChild(allImages[i]);
      }
      animateNewTitle(index);
      animateIndicators(index);
    }

    function pinSlider(scrolled, total) {
      const vh = window.innerHeight;
      if (scrolled <= 0) {
        sliderSection.style.position = "absolute";
        sliderSection.style.top = "0";
        sliderSection.style.left = "0";
        sliderSection.style.width = "100%";
        sliderSection.style.transform = "";
      } else if (scrolled >= total) {
        sliderSection.style.position = "absolute";
        sliderSection.style.top = total + "px";
        sliderSection.style.left = "0";
        sliderSection.style.width = "100%";
        sliderSection.style.transform = "";
      } else {
        // Fixed pin while track is scrolling through
        const trackRect = track.getBoundingClientRect();
        sliderSection.style.position = "fixed";
        sliderSection.style.top = "0";
        sliderSection.style.left = trackRect.left + "px";
        sliderSection.style.width = trackRect.width + "px";
        sliderSection.style.height = vh + "px";
        sliderSection.style.transform = "";
      }
    }

    function onScroll() {
      const rect = track.getBoundingClientRect();
      const total = Math.max(track.offsetHeight - window.innerHeight, 1);
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      pinSlider(scrolled, total);
      const progress = scrolled / total;
      if (progressEl) progressEl.style.transform = "translateX(-50%) scaleY(" + progress + ")";
      let current = Math.floor(progress * slides.length + 1e-6);
      if (current >= slides.length) current = slides.length - 1;
      if (current < 0) current = 0;
      if (progress >= 0.999) current = slides.length - 1;
      animateNewSlide(current);
      track.dataset.icpProgress = String(progress.toFixed(3));
      track.dataset.icpSlide = String(current);
    }

    function requestTick() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    }

    animateNewSlide(0);
    window.addEventListener("scroll", requestTick, { passive: true, capture: true });
    document.addEventListener("scroll", requestTick, { passive: true, capture: true });
    window.addEventListener("resize", requestTick, { passive: true });
    onScroll();
  }

  function replaceFeaturesSection() {
    const sec = document.getElementById("features-section");
    if (!sec) return;
    // Framer hydrate can wipe children while leaving a stale mount flag
    if (sec.dataset.icpFsMounted && !sec.querySelector(".icp-fs-root")) {
      delete sec.dataset.icpFsMounted;
    }
    if (sec.dataset.icpFsMounted) {
      // Already mounted with live DOM — nudge scroll handler via resize
      window.dispatchEvent(new Event("resize"));
      return;
    }
    mount(sec, { showOutro: false, showIntro: true });
  }

  /**
   * Fallback scroll-fill reveal for #solution-section if Framer's GSAP
   * ScrollTrigger didn't bind (e.g. after third-party script conflicts).
   * Paragraphs reveal sequentially (para 1 fully, then para 2) so the
   * second block is not already bright while the first is mid-scrub.
   */

  function ensureSolutionReveal() {
    const sol = document.getElementById("solution-section");
    if (!sol) return;

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getClientRects();
      return r.length > 0 && r[0].width > 0 && r[0].height > 0;
    };

    const collectTargets = () => {
      const fills = [...sol.querySelectorAll(".fill-layer")].filter(isVisible);
      const all = [];
      fills.forEach((fill) => {
        let targets = [...fill.querySelectorAll(".char")];
        if (!targets.length) targets = [...fill.querySelectorAll(".word")];
        // If Framer hasn't split yet, soft-split (skip when accent markup present)
        if (!targets.length && fill.childNodes.length && !fill.querySelector(".accent")) {
          const text = fill.textContent || "";
          if (text.trim()) {
            fill.innerHTML = "";
            text.split(/(\s+)/).forEach((token) => {
              if (!token) return;
              if (/^\s+$/.test(token)) {
                fill.appendChild(document.createTextNode(token));
                return;
              }
              const word = document.createElement("span");
              word.className = "word";
              word.style.display = "inline-block";
              [...token].forEach((ch) => {
                const span = document.createElement("span");
                span.className = "char";
                span.style.display = "inline-block";
                span.textContent = ch;
                word.appendChild(span);
              });
              fill.appendChild(word);
            });
            targets = [...fill.querySelectorAll(".char")];
          }
        }
        targets.forEach((el) => {
          el.style.willChange = "opacity";
          all.push(el);
        });
      });
      return all;
    };

    let ticking = false;
    const onScroll = () => {
      const targets = collectTargets();
      if (!targets.length) return;

      const rect = sol.getBoundingClientRect();
      // Start reveal when section reaches mid-screen
      const start = window.innerHeight * 0.5;
      const end = window.innerHeight * -0.35;
      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / Math.max(start - end, 1))
      );

      const n = Math.max(targets.length, 1);
      const windowSize = Math.max(1.5 / n, 0.012);
      targets.forEach((el, i) => {
        const t0 = i / n;
        const local = Math.min(1, Math.max(0, (progress - t0) / windowSize));
        el.style.setProperty("opacity", String(local), "important");
      });
    };

    const requestTick = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    };

    if (!sol.dataset.icpRevealBound) {
      window.addEventListener("scroll", requestTick, { passive: true, capture: true });
      document.addEventListener("scroll", requestTick, { passive: true, capture: true });
      window.addEventListener("resize", requestTick, { passive: true });
      setInterval(onScroll, 100);
      sol.dataset.icpRevealBound = "fallback";
    }
    onScroll();
  }

  /**
   * Numbers section: left column is position:sticky (top:144px) while headline
   * words scrub muted → white. Framer GSAP often missing on the mirror — drive
   * the highlight from scroll.
   */
  function ensureNumbersReveal() {
    const sec = document.getElementById("numbers-section");
    if (!sec) return;

    const DIM_A = 0.22;

    const findHeadline = () => {
      const named = sec.querySelector(
        '[data-framer-name*="AI-assisted"], .framer-g3mtlg'
      );
      return (named && named.querySelector("h2")) || sec.querySelector("h2");
    };

    const ensureWords = () => {
      const h2 = findHeadline();
      if (!h2) return [];
      if (h2.dataset.icpWords === "1") {
        return [...h2.querySelectorAll(".icp-num-word")];
      }
      const text = (h2.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return [];
      h2.textContent = "";
      const words = [];
      text.split(/(\s+)/).forEach((token) => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          h2.appendChild(document.createTextNode(token));
          return;
        }
        const span = document.createElement("span");
        span.className = "icp-num-word";
        span.textContent = token;
        span.style.color = "rgba(255, 255, 255, " + DIM_A + ")";
        h2.appendChild(span);
        words.push(span);
      });
      h2.dataset.icpWords = "1";
      return words;
    };

    let ticking = false;
    const onScroll = () => {
      const words = ensureWords();
      if (!words.length) return;

      const rect = sec.getBoundingClientRect();
      const stickyTop = 144;
      const travel = Math.max(rect.height - window.innerHeight + stickyTop, 1);
      const scrolled = stickyTop - rect.top;
      const progress = Math.min(1, Math.max(0, scrolled / travel));

      const n = words.length;
      const windowSize = Math.max(1.2 / n, 0.04);
      words.forEach((el, i) => {
        const t0 = i / n;
        const local = Math.min(1, Math.max(0, (progress - t0) / windowSize));
        const a = (DIM_A + local * (1 - DIM_A)).toFixed(3);
        el.style.color = "rgba(255, 255, 255, " + a + ")";
      });
    };

    const requestTick = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    };

    if (!sec.dataset.icpNumbersRevealBound) {
      window.addEventListener("scroll", requestTick, { passive: true, capture: true });
      document.addEventListener("scroll", requestTick, { passive: true, capture: true });
      window.addEventListener("resize", requestTick, { passive: true });
      setInterval(onScroll, 120);
      sec.dataset.icpNumbersRevealBound = "fallback";
    }
    onScroll();
  }

  global.IcpFullscreenSlider = {
    mount: mount,
    replaceFeaturesSection: replaceFeaturesSection,
    ensureSolutionReveal: ensureSolutionReveal,
    ensureNumbersReveal: ensureNumbersReveal,
    DEFAULT_SLIDES: DEFAULT_SLIDES,
  };
})(typeof window !== "undefined" ? window : globalThis);
