import { useEffect, useState, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import PurchaseForm from "./pages/PurchaseForm";
import Checkout from "./pages/Checkout";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Success from "./pages/Success";
import Order from "./pages/Order";
import MyOrders from "./pages/PesananSaya";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ProfilePage from "./pages/Profile";
import Header from "./components/Header";
import LiveStream from "./pages/live";
import Verify from "./pages/verify";
import Replay from "./pages/replay";

// ══════════════════════════════════════════════════════════════════════════════
//  MOBILE DETECTION — used to skip size-based checks on real phones
// ══════════════════════════════════════════════════════════════════════════════
const isMobileDevice = () => {
  const ua              = navigator.userAgent || "";
  const hasTouchPoints  = navigator.maxTouchPoints > 1;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mobileUA        = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
  // Need ≥ 2 of 3 signals to be classified as real mobile device
  const score = [hasTouchPoints, hasCoarsePointer, mobileUA].filter(Boolean).length;
  return score >= 2;
};

// ══════════════════════════════════════════════════════════════════════════════
//  MEDIA KILLER
// ══════════════════════════════════════════════════════════════════════════════
const killAllMedia = () => {
  try {
    document.querySelectorAll("video, audio").forEach((el) => {
      try { el.pause(); el.src = ""; el.load(); } catch {}
    });
  } catch {}
};

// ══════════════════════════════════════════════════════════════════════════════
//  DEVTOOLS DETECTION METHODS
// ══════════════════════════════════════════════════════════════════════════════

// Method 1: Window size diff — DESKTOP ONLY (skipped on mobile to prevent false positives)
const detectBySize = () => {
  if (isMobileDevice()) return false;
  const THRESHOLD = 130;
  return (
    window.outerWidth  - window.innerWidth  > THRESHOLD ||
    window.outerHeight - window.innerHeight > THRESHOLD
  );
};

// Method 2: console.log getter trick (works on all platforms)
let _consoleDetected = false;
const _devImg = (() => {
  const img = new Image();
  Object.defineProperty(img, "id", {
    get() { _consoleDetected = true; return "x"; },
  });
  return img;
})();
const detectByConsole = () => {
  _consoleDetected = false;
  window.console.log(_devImg);
  window.console.clear();
  return _consoleDetected;
};

// Method 3: toString/valueOf trick (works on all platforms)
const detectByToString = () => {
  let hit = false;
  const o = { toString() { hit = true; return ""; }, valueOf() { hit = true; return 0; } };
  window.console.log(o);
  window.console.clear();
  return hit;
};

// Method 4: debugger timing — DESKTOP ONLY
const detectByDebugger = () => {
  if (isMobileDevice()) return false;
  const t = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - t > 100;
};

// Method 5: Firebug legacy
const detectFirebug = () =>
  !!(window.Firebug?.chrome?.isInitialized);

// Aggregate fast (safe on mobile)
const runFastDetections = () => {
  try {
    return detectBySize() || detectByConsole() || detectByToString() || detectFirebug();
  } catch { return false; }
};

// ══════════════════════════════════════════════════════════════════════════════
//  INPUT BLOCKERS
// ══════════════════════════════════════════════════════════════════════════════
const blockContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

const blockDevKeys = (e) => {
  const key = e.key?.toLowerCase() ?? "";
  if (e.keyCode === 123 || key === "f12") {
    e.preventDefault(); e.stopPropagation(); return false;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c","k"].includes(key)) {
    e.preventDefault(); e.stopPropagation(); return false;
  }
  if ((e.ctrlKey || e.metaKey) && ["u","s","p"].includes(key)) {
    e.preventDefault(); e.stopPropagation(); return false;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  ANTI-SCRAPING LAYER
// ══════════════════════════════════════════════════════════════════════════════
const applyAntiScraping = () => {
  // 1. Disable text selection (except inputs)
  if (!document.getElementById("__as_css__")) {
    const s = document.createElement("style");
    s.id = "__as_css__";
    s.textContent = `
      *{-webkit-user-select:none!important;-moz-user-select:none!important;user-select:none!important}
      input,textarea{-webkit-user-select:text!important;user-select:text!important}
    `;
    document.head.appendChild(s);
  }

  // 2. Block drag-to-copy
  document.addEventListener("dragstart", (e) => e.preventDefault(), { capture: true, passive: false });

  // 3. Block copy/cut (allow in inputs)
  const blockClip = (e) => {
    if (["INPUT","TEXTAREA"].includes(e.target?.tagName)) return;
    e.preventDefault();
    e.stopPropagation();
    // Poison clipboard
    try { navigator.clipboard?.writeText?.(""); } catch {}
  };
  document.addEventListener("copy", blockClip, { capture: true });
  document.addEventListener("cut",  blockClip, { capture: true });

  // 4. Block print
  window.addEventListener("beforeprint", (e) => { e.preventDefault(); }, { capture: true });
  window.print = () => {};

  // 5. Detect headless / bot UA
  const ua = (navigator.userAgent || "").toLowerCase();
  const botPatterns = [
    "headless","phantomjs","selenium","puppeteer","playwright",
    "webdriver","bot/","crawl","spider","scrapy","wget",
    "python-requests","python-urllib","axios/","httpclient",
    "libwww","java/1","go-http","ruby","perl/",
  ];
  if (botPatterns.some((p) => ua.includes(p))) {
    document.documentElement.innerHTML = "";
    window.stop?.();
    return;
  }

  // 6. Block webdriver flag
  if (navigator.webdriver === true) {
    document.documentElement.innerHTML = "";
    window.stop?.();
    return;
  }

  // 7. Detect automation globals
  const autoGlobals = [
    "__webdriver_evaluate","__selenium_evaluate","__webdriver_script_function",
    "__webdriver_script_func","__webdriver_script_fn","__fxdriver_evaluate",
    "__driver_unwrapped","__webdriver_unwrapped","__driver_evaluate",
    "__selenium_unwrapped","__fxdriver_unwrapped","callPhantom","_phantom",
    "__nightmare","domAutomation","domAutomationController","_selenium","__$webdriverAsyncExecutor",
  ];
  if (autoGlobals.some((g) => g in window)) {
    document.documentElement.innerHTML = "";
    window.stop?.();
    return;
  }

  // 8. Override fetch to block direct API scraping from the page context
  //    (prevents injected scripts from calling your APIs via fetch)
  const _origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    // Allow your own API calls — block everything else if webdriver is active
    if (navigator.webdriver) throw new Error("Forbidden");
    return _origFetch(input, init);
  };

  // 9. Override XMLHttpRequest similarly
  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    if (navigator.webdriver) throw new Error("Forbidden");
    return _origOpen.apply(this, args);
  };
};

// ══════════════════════════════════════════════════════════════════════════════
//  DevTools Blocker UI
// ══════════════════════════════════════════════════════════════════════════════
function DevToolsBlocker() {
  useEffect(() => {
    killAllMedia();
    const t = setInterval(killAllMedia, 200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      onContextMenu={blockContextMenu}
      style={{
        position:"fixed", inset:0, background:"#000",
        zIndex:2147483647, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:"20px",
        userSelect:"none", WebkitUserSelect:"none",
        cursor:"not-allowed", fontFamily:"system-ui,sans-serif",
      }}
    >
      <div style={{ fontSize:"clamp(48px,12vw,72px)" }}>🚫</div>
      <p style={{
        color:"#fff", fontSize:"clamp(1.4rem,6vw,2.6rem)",
        fontWeight:900, margin:0, letterSpacing:"4px",
        textAlign:"center", textTransform:"uppercase", padding:"0 24px",
      }}>
        Mau ngapain?
      </p>
      <p style={{
        color:"#444", fontSize:"clamp(11px,3vw,13px)",
        margin:0, textAlign:"center", padding:"0 40px", lineHeight:1.8,
      }}>
        Developer Tools terdeteksi.<br/>
        Tutup DevTools untuk melanjutkan.
      </p>
      <div style={{ width:"60px", height:"3px", background:"#DC1F2E", borderRadius:"2px" }}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Hook: useStrictDevToolsDetection
// ══════════════════════════════════════════════════════════════════════════════
function useStrictDevToolsDetection() {
  const [detected,     setDetected]     = useState(false);
  const lockedRef                       = useRef(false);
  const consecutiveRef                  = useRef(0);
  const fastIntervalRef                 = useRef(null);
  const slowIntervalRef                 = useRef(null);

  // Mobile needs more consecutive hits to avoid false positives
  const THRESHOLD = isMobileDevice() ? 5 : 2;

  const trigger = useCallback(() => {
    if (lockedRef.current) return;
    consecutiveRef.current += 1;
    if (consecutiveRef.current >= THRESHOLD) {
      lockedRef.current = true;
      killAllMedia();
      setDetected(true);
    }
  }, [THRESHOLD]);

  const resetCount = useCallback(() => {
    if (!lockedRef.current) consecutiveRef.current = 0;
  }, []);

  useEffect(() => {
    applyAntiScraping();

    document.addEventListener("contextmenu", blockContextMenu, { capture: true });
    document.addEventListener("keydown",     blockDevKeys,      { capture: true });
    document.addEventListener("keyup",       blockDevKeys,      { capture: true });

    // Fast poll — console/toString safe on all devices
    fastIntervalRef.current = setInterval(() => {
      if (lockedRef.current) return;
      runFastDetections() ? trigger() : resetCount();
    }, 400);

    // Slow poll — debugger timing (desktop only)
    slowIntervalRef.current = setInterval(() => {
      if (lockedRef.current) return;
      if (detectByDebugger()) trigger();
    }, 3000);

    // Resize — desktop only
    const onResize = () => {
      if (lockedRef.current || isMobileDevice()) return;
      detectBySize() ? trigger() : resetCount();
    };
    window.addEventListener("resize", onResize);

    // Visibility change
    const onVisibility = () => {
      if (lockedRef.current) return;
      if (document.visibilityState === "visible" && runFastDetections()) trigger();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Initial check — mobile uses only console-safe methods
    if (isMobileDevice()) {
      if (detectByConsole() || detectByToString()) trigger();
    } else {
      if (runFastDetections() || detectByDebugger()) trigger();
    }

    return () => {
      clearInterval(fastIntervalRef.current);
      clearInterval(slowIntervalRef.current);
      document.removeEventListener("contextmenu",      blockContextMenu, { capture: true });
      document.removeEventListener("keydown",          blockDevKeys,      { capture: true });
      document.removeEventListener("keyup",            blockDevKeys,      { capture: true });
      window.removeEventListener("resize",             onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [trigger, resetCount]);

  return detected;
}

// ══════════════════════════════════════════════════════════════════════════════
//  App
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const devToolsOpen = useStrictDevToolsDetection();
  if (devToolsOpen) return <DevToolsBlocker />;

  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/"                   element={<Home />} />
          <Route path="/keranjang"          element={<Cart />} />
          <Route path="/product/:id"        element={<ProductDetail />} />
          <Route path="/purchase/:id"       element={<PurchaseForm />} />
          <Route path="/checkout"           element={<Checkout />} />
          <Route path="/wish"               element={<Wishlist />} />
          <Route path="/success"            element={<Success />} />
          <Route path="/order"              element={<Order />} />
          <Route path="/myorder"            element={<MyOrders />} />
          <Route path="/register"           element={<Register />} />
          <Route path="/login"              element={<Login />} />
          <Route path="/profile"            element={<ProfilePage />} />
          <Route path="/live/:playbackId"   element={<LiveStream />} />
          <Route path="/verify"             element={<Verify />} />
          <Route path="/replay/:playbackId" element={<Replay />} />
          <Route path="*"                   element={<NotFound />} />
        </Routes>
      </main>
    </Router>
  );
}

// ── 404 ───────────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{
      textAlign:"center", padding:"50px 20px", minHeight:"60vh",
      display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center",
    }}>
      <h1 style={{ fontSize:"48px", color:"#e74c3c", marginBottom:"20px" }}>404</h1>
      <h2 style={{ fontSize:"24px", marginBottom:"20px" }}>Halaman Tidak Ditemukan</h2>
      <p style={{ fontSize:"16px", color:"#666", marginBottom:"30px" }}>
        Maaf, halaman yang Anda cari tidak dapat ditemukan.
      </p>
      <a href="/" style={{
        backgroundColor:"#3498db", color:"white",
        padding:"12px 24px", textDecoration:"none",
        borderRadius:"4px", fontSize:"16px",
      }}>
        Kembali ke Beranda
      </a>
    </div>
  );
}

export default App;
