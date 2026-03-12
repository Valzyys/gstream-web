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
//  DEVTOOLS BLOCKER — Multi-layer, ultra-strict
// ══════════════════════════════════════════════════════════════════════════════

/** Kill all media instantly */
const killAllMedia = () => {
  try {
    document.querySelectorAll("video, audio").forEach((el) => {
      try { el.pause(); el.src = ""; el.load(); } catch {}
    });
  } catch {}
};

/** Permanently freeze the page (non-recoverable without full reload) */
const freezePage = () => {
  killAllMedia();
};

// ── Method 1: window size diff ────────────────────────────────────────────────
const detectBySize = () => {
  const THRESHOLD = 100;
  return (
    window.outerWidth  - window.innerWidth  > THRESHOLD ||
    window.outerHeight - window.innerHeight > THRESHOLD
  );
};

// ── Method 2: console.log getter trick ───────────────────────────────────────
let _consoleDetected = false;
const _devImg = new Image();
Object.defineProperty(_devImg, "id", {
  get() { _consoleDetected = true; return ""; },
});

const detectByConsole = () => {
  _consoleDetected = false;
  // Using indirect call to avoid ESLint no-console blocking the trick
  const c = window.console;
  c.log(_devImg);  // triggers getter only when DevTools is open
  c.clear();
  return _consoleDetected;
};

// ── Method 3: debugger timing ─────────────────────────────────────────────────
const detectByDebugger = () => {
  const t = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - t > 80;
};

// ── Method 4: toString override timing ───────────────────────────────────────
const detectByToString = () => {
  let detected = false;
  const obj = { toString: () => { detected = true; return ""; } };
  // DevTools calls toString on objects when inspecting
  window.console.log(obj);
  window.console.clear();
  return detected;
};

// ── Method 5: Firebug legacy ──────────────────────────────────────────────────
const detectFirebug = () => {
  return !!(window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized);
};

// ── Method 6: block right-click ──────────────────────────────────────────────
const blockContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

// ── Method 7: block keyboard shortcuts ───────────────────────────────────────
const blockDevKeys = (e) => {
  const key = e.key?.toLowerCase();
  const code = e.code?.toLowerCase();

  // F12
  if (e.keyCode === 123 || key === "f12") { e.preventDefault(); e.stopPropagation(); return false; }
  // Ctrl/Cmd + Shift + I / J / C / K
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c","k"].includes(key)) {
    e.preventDefault(); e.stopPropagation(); return false;
  }
  // Ctrl/Cmd + U (view source)
  if ((e.ctrlKey || e.metaKey) && key === "u") { e.preventDefault(); e.stopPropagation(); return false; }
  // Ctrl/Cmd + S (save page)
  if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); e.stopPropagation(); return false; }
  // Ctrl/Cmd + P (print)
  if ((e.ctrlKey || e.metaKey) && key === "p") { e.preventDefault(); e.stopPropagation(); return false; }
};

// ── Aggregate all detection methods ──────────────────────────────────────────
const runAllDetections = () => {
  try {
    return (
      detectBySize()     ||
      detectByConsole()  ||
      detectByToString() ||
      detectFirebug()
      // Note: detectByDebugger() called separately (heavier)
    );
  } catch {
    return false;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  DevTools Blocker Component
// ══════════════════════════════════════════════════════════════════════════════
function DevToolsBlocker() {
  useEffect(() => {
    freezePage();
    // Keep killing any media that tries to play
    const interval = setInterval(killAllMedia, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      onContextMenu={blockContextMenu}
      style={{
        position:       "fixed",
        inset:          0,
        background:     "#000",
        zIndex:         2147483647, // max z-index
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            "20px",
        userSelect:     "none",
        WebkitUserSelect: "none",
        cursor:         "not-allowed",
      }}
    >
      <div style={{ fontSize: "64px", filter: "grayscale(1)" }}>🚫</div>

      <p style={{
        color:       "#fff",
        fontSize:    "clamp(1.6rem, 5vw, 2.8rem)",
        fontWeight:  900,
        margin:      0,
        letterSpacing: "4px",
        textAlign:   "center",
        textTransform: "uppercase",
        padding:     "0 24px",
      }}>
        Mau ngapain?
      </p>

      <p style={{
        color:     "#333",
        fontSize:  "13px",
        margin:    0,
        textAlign: "center",
        padding:   "0 40px",
        lineHeight: 1.7,
      }}>
        Developer Tools terdeteksi.<br />
        Tutup DevTools untuk melanjutkan.
      </p>

      {/* Decorative red line */}
      <div style={{
        width:        "60px",
        height:       "3px",
        background:   "#DC1F2E",
        borderRadius: "2px",
      }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Hook: useStrictDevToolsDetection
// ══════════════════════════════════════════════════════════════════════════════
function useStrictDevToolsDetection() {
  const [detected, setDetected] = useState(false);
  const lockedRef               = useRef(false);   // once true, never goes back to false
  const intervalRef             = useRef(null);
  const slowIntervalRef         = useRef(null);

  const trigger = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    freezePage();
    setDetected(true);
  }, []);

  useEffect(() => {
    // ── Attach global event blockers immediately ───────────────────────────
    document.addEventListener("contextmenu", blockContextMenu,  { capture: true });
    document.addEventListener("keydown",     blockDevKeys,       { capture: true });
    document.addEventListener("keyup",       blockDevKeys,       { capture: true });

    // ── Fast polling (every 300ms) — size + console tricks ────────────────
    intervalRef.current = setInterval(() => {
      if (lockedRef.current) return;
      if (runAllDetections()) trigger();
    }, 300);

    // ── Slow polling (every 2s) — debugger timing (expensive) ─────────────
    slowIntervalRef.current = setInterval(() => {
      if (lockedRef.current) return;
      if (detectByDebugger()) trigger();
    }, 2000);

    // ── Run once immediately ───────────────────────────────────────────────
    if (runAllDetections() || detectByDebugger()) trigger();

    // ── Detect window resize (undocking devtools) ─────────────────────────
    const onResize = () => {
      if (lockedRef.current) return;
      if (detectBySize()) trigger();
    };
    window.addEventListener("resize", onResize);

    // ── Detect visibility change (switching to devtools window) ───────────
    const onVisible = () => {
      if (lockedRef.current) return;
      if (runAllDetections()) trigger();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(slowIntervalRef.current);
      document.removeEventListener("contextmenu",      blockContextMenu, { capture: true });
      document.removeEventListener("keydown",          blockDevKeys,      { capture: true });
      document.removeEventListener("keyup",            blockDevKeys,      { capture: true });
      window.removeEventListener("resize",             onResize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [trigger]);

  return detected;
}

// ══════════════════════════════════════════════════════════════════════════════
//  App
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const devToolsOpen = useStrictDevToolsDetection();

  // If devtools detected — render ONLY the blocker, nothing else
  if (devToolsOpen) return <DevToolsBlocker />;

  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/keranjang"    element={<Cart />} />
          <Route path="/product/:id"  element={<ProductDetail />} />
          <Route path="/purchase/:id" element={<PurchaseForm />} />
          <Route path="/checkout"     element={<Checkout />} />
          <Route path="/wish"         element={<Wishlist />} />
          <Route path="/success"      element={<Success />} />
          <Route path="/order"        element={<Order />} />
          <Route path="/myorder"      element={<MyOrders />} />
          <Route path="/register"     element={<Register />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/live/:playbackId" element={<LiveStream />} />
          <Route path="/verify"       element={<Verify />} />
          <Route path="/replay/:playbackId" element={<Replay />} />
          <Route path="*"             element={<NotFound />} />
        </Routes>
      </main>
    </Router>
  );
}

// ── 404 ───────────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{
      textAlign:      "center",
      padding:        "50px 20px",
      minHeight:      "60vh",
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "center",
      alignItems:     "center",
    }}>
      <h1 style={{ fontSize: "48px", color: "#e74c3c", marginBottom: "20px" }}>404</h1>
      <h2 style={{ fontSize: "24px", marginBottom: "20px" }}>Halaman Tidak Ditemukan</h2>
      <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
        Maaf, halaman yang Anda cari tidak dapat ditemukan.
      </p>
      <a
        href="/"
        style={{
          backgroundColor: "#3498db",
          color:           "white",
          padding:         "12px 24px",
          textDecoration:  "none",
          borderRadius:    "4px",
          fontSize:        "16px",
        }}
      >
        Kembali ke Beranda
      </a>
    </div>
  );
}

export default App;
