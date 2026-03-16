import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_USER = "JKT48Connect";
const ADMIN_PASS = "010907";
const API_BASE   = "https://v2.jkt48connect.com/api/jkt48";
const API_KEY    = "JKTCONNECT";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a character-map JSON object {"0":"#","1":"E",...} into a plain string.
 * Mirrors the Node.js charmap_to_string helper used on the backend.
 */
function charmapToString(obj) {
  return Object.keys(obj)
    .filter((k) => !isNaN(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k])
    .join("");
}

/** Returns true when every own key of obj is a numeric string */
function isCharmap(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every((k) => !isNaN(k));
}

/**
 * Parse an M3U8 master-playlist string into { session, streams }.
 * Produces the same structure as the structured JSON output (doc 4 / doc 7).
 */
function parseM3U8(m3u8) {
  const lines  = m3u8.split("\n").map((l) => l.trim()).filter(Boolean);
  const session = {};
  const streams = [];
  let current  = null;

  for (const line of lines) {
    if (line.startsWith("#EXT-X-SESSION-DATA:")) {
      const id  = (line.match(/DATA-ID="([^"]+)"/)  || [])[1];
      const val = (line.match(/VALUE="([^"]+)"/)    || [])[1];
      if (id && val !== undefined) session[id] = val;
      continue;
    }
    if (line.startsWith("#EXT-X-MEDIA:")) {
      current = {};
      const get = (re) => (line.match(re) || [])[1];
      current.TYPE        = get(/TYPE=([^,\n]+)/);
      current["GROUP-ID"] = get(/GROUP-ID="([^"]+)"/);
      current.NAME        = get(/NAME="([^"]+)"/);
      current.AUTOSELECT  = get(/AUTOSELECT=([^,\n]+)/);
      current.DEFAULT     = get(/DEFAULT=([^,\n]+)/);
      continue;
    }
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      if (!current) current = {};
      const get = (re) => (line.match(re) || [])[1];
      current.BANDWIDTH      = get(/BANDWIDTH=(\d+)/);
      current.RESOLUTION     = get(/RESOLUTION=([^\s,]+)/);
      current.CODECS         = get(/CODECS="([^"]+)"/);
      current.VIDEO          = get(/VIDEO="([^"]+)"/);
      current["FRAME-RATE"]  = get(/FRAME-RATE=([\d.]+)/);
      continue;
    }
    // URL line that follows #EXT-X-STREAM-INF
    if (!line.startsWith("#") && current && current.BANDWIDTH) {
      current.url = line;
      streams.push(current);
      current = null;
    }
  }
  return { session, streams };
}

/**
 * Resolve a raw API response from /live/show into { session, streams, raw }.
 * Handles three cases:
 *   1. Already-structured JSON  → { session, streams }
 *   2. Charmap JSON             → decode → parse M3U8 or inner JSON
 *   3. Normal flat JSON         → extract stream_url / playback_url
 */
function resolveStreamResponse(data) {
  // ── Case 1: already structured ────────────────────────────────────────────
  if (data && Array.isArray(data.streams) && data.streams.length) {
    return { session: data.session || {}, streams: data.streams, raw: data };
  }

  // ── Case 2: charmap ────────────────────────────────────────────────────────
  if (isCharmap(data)) {
    const str = charmapToString(data).trim();

    if (str.startsWith("#EXTM3U")) {
      const parsed = parseM3U8(str);
      return { ...parsed, raw: { success: true, ...parsed } };
    }

    // Maybe the charmap encodes a JSON string
    try {
      const inner = JSON.parse(str);
      return resolveStreamResponse(inner); // recurse once
    } catch {
      return { session: {}, streams: [], raw: { raw_string: str } };
    }
  }

  // ── Case 3: flat JSON with a stream URL ────────────────────────────────────
  const flatUrl =
    data?.stream_url         ||
    data?.data?.stream_url   ||
    data?.playback_url       ||
    data?.data?.playback_url ||
    data?.url                ||
    null;

  if (flatUrl) {
    return {
      session: {},
      streams: [{ NAME: "default", BANDWIDTH: "0", url: flatUrl }],
      raw: data,
    };
  }

  return { session: {}, streams: [], raw: data };
}

/** Normalise a timestamp (seconds or ms) to a JS Date */
function tsToDate(ts) {
  if (!ts) return null;
  const n = Number(ts);
  return new Date(n < 1e12 ? n * 1000 : n);
}

/** Return today's date string in WIB (UTC+7) as "YYYY-MM-DD" */
function todayWIB() {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

/** Check whether a slug's embedded date matches today WIB. */
function slugMatchesToday(slug) {
  if (!slug) return false;
  const today = todayWIB();
  const match = slug.match(/(\d{4}-\d{2}-\d{2})/g);
  if (!match) return false;
  return match.some((d) => d === today);
}

/** Fallback: compare scheduled_at / live_at date against today WIB */
function itemMatchesToday(item) {
  if (slugMatchesToday(item.slug)) return true;
  const candidates = [item.scheduled_at, item.live_at, item.end_at].filter(Boolean);
  const today = todayWIB();
  return candidates.some((ts) => {
    const d = tsToDate(ts);
    if (!d) return false;
    const wib = new Date(d.getTime() + 7 * 3600 * 1000);
    return wib.toISOString().slice(0, 10) === today;
  });
}

// ─── HLS Player (native or hls.js fallback) ───────────────────────────────────
function HLSPlayer({ src, title }) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;

    const cleanup = () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };

    cleanup();
    setStatus("loading");

    // Native HLS (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().then(() => setStatus("playing")).catch(() => setStatus("error"));
      return cleanup;
    }

    // hls.js
    const loadHls = async () => {
      try {
        const Hls = (await import("hls.js")).default;
        if (!Hls.isSupported()) { setStatus("error"); return; }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setStatus("error");
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(() => setStatus("playing")).catch(() => {});
        });

        hls.loadSource(src);
        hls.attachMedia(video);
      } catch { setStatus("error"); }
    };

    loadHls();
    return cleanup;
  }, [src]);

  return (
    <div style={{ position: "relative", width: "100%", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "#0a0a0a", zIndex: 2, gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, border: "3px solid #DC1F2E33",
            borderTop: "3px solid #DC1F2E", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ color: "#888", fontSize: 13 }}>Memuat stream…</span>
        </div>
      )}
      {status === "error" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "#0a0a0a", zIndex: 2, gap: 8,
        }}>
          <span style={{ fontSize: 36 }}>⚠️</span>
          <span style={{ color: "#DC1F2E", fontWeight: 700 }}>Gagal memuat stream</span>
          <span style={{ color: "#555", fontSize: 12 }}>Coba refresh atau pilih slug lain</span>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        muted={false}
        style={{ width: "100%", display: "block", maxHeight: "56.25vw", background: "#000" }}
        playsInline
        title={title}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminLive() {
  const navigate = useNavigate();

  // Auth
  const [authed,        setAuthed]        = useState(false);
  const [loginForm,     setLoginForm]     = useState({ username: "", password: "" });
  const [loginError,    setLoginError]    = useState("");
  const [loginLoading,  setLoginLoading]  = useState(false);

  // Shows list
  const [shows,         setShows]         = useState([]);
  const [showsLoading,  setShowsLoading]  = useState(false);
  const [showsError,    setShowsError]    = useState("");

  // Selected show
  const [selectedSlug,  setSelectedSlug]  = useState(null);
  const [selectedShow,  setSelectedShow]  = useState(null);

  // Stream
  const [streamData,    setStreamData]    = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError,   setStreamError]   = useState("");

  // ── Restore session ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("adminlive_auth");
    if (saved === "1") setAuthed(true);
  }, []);

  // ── Fetch shows ──────────────────────────────────────────────────────────
  const fetchShows = useCallback(async () => {
    setShowsLoading(true);
    setShowsError("");
    try {
      const res  = await fetch(`${API_BASE}/idnplus?apikey=${API_KEY}`);
      const json = await res.json();
      const list = json.data || [];

      const todayItems = list.filter(itemMatchesToday);
      setShows(todayItems.length ? todayItems : list);

      if (todayItems.length) {
        setSelectedSlug(todayItems[0].slug);
        setSelectedShow(todayItems[0]);
      }
    } catch (e) {
      setShowsError("Gagal mengambil daftar show: " + e.message);
    } finally {
      setShowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchShows();
  }, [authed, fetchShows]);

  // ── Fetch stream when slug changes ───────────────────────────────────────
  useEffect(() => {
    if (!selectedSlug) return;
    const load = async () => {
      setStreamLoading(true);
      setStreamError("");
      setStreamData(null);
      try {
        const url  = `${API_BASE}/live/show?slug=${encodeURIComponent(selectedSlug)}&apikey=${API_KEY}`;
        const res  = await fetch(url);
        const raw  = await res.json();

        // ── Decode charmap / M3U8 / flat JSON ──────────────────────────────
        const resolved = resolveStreamResponse(raw);

        if (!resolved.streams.length) {
          setStreamData({ url: null, streams: [], session: {}, raw: resolved.raw });
          return;
        }

        // Pick best quality: 1080p60 > 1080p > 720p60 > 720p > first available
        const PREF = ["1080p60", "1080p", "720p60", "720p", "chunked"];
        let picked = null;
        for (const name of PREF) {
          picked = resolved.streams.find(
            (s) => s.NAME === name || s["GROUP-ID"] === name
          );
          if (picked) break;
        }
        const bestUrl = (picked || resolved.streams[0])?.url || null;

        setStreamData({
          url:     bestUrl,
          streams: resolved.streams,
          session: resolved.session,
          raw:     resolved.raw,
        });
      } catch (e) {
        setStreamError(e.message);
      } finally {
        setStreamLoading(false);
      }
    };
    load();
  }, [selectedSlug]);

  // ── Login handler ─────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    setTimeout(() => {
      if (loginForm.username === ADMIN_USER && loginForm.password === ADMIN_PASS) {
        sessionStorage.setItem("adminlive_auth", "1");
        setAuthed(true);
      } else {
        setLoginError("Username atau password salah.");
      }
      setLoginLoading(false);
    }, 600);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminlive_auth");
    setAuthed(false);
    setShows([]);
    setStreamData(null);
    setSelectedSlug(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <style>{globalStyles}</style>
        <div className="al-login-bg">
          <div className="al-noise" />
          <div className="al-login-card">
            <div className="al-logo">
              <span className="al-logo-icon">⬡</span>
              <span className="al-logo-text">ADMIN<em>LIVE</em></span>
            </div>
            <p className="al-login-sub">JKT48Connect Internal Panel</p>

            <form onSubmit={handleLogin} className="al-form">
              <div className="al-field">
                <label>Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="al-field">
                <label>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>

              {loginError && <div className="al-error">{loginError}</div>}

              <button type="submit" className="al-btn-primary" disabled={loginLoading}>
                {loginLoading ? <span className="al-spin" /> : "→ MASUK"}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalStyles}</style>
      <div className="al-dashboard">
        <div className="al-noise" />

        {/* ── Top bar ── */}
        <header className="al-header">
          <div className="al-header-left">
            <span className="al-logo-icon sm">⬡</span>
            <span className="al-header-title">ADMINLIVE</span>
            <span className="al-badge">ADMIN</span>
          </div>
          <div className="al-header-right">
            <span className="al-today">📅 {todayWIB()} WIB</span>
            <button className="al-btn-ghost" onClick={() => navigate(-1)}>← Back</button>
            <button className="al-btn-danger" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="al-content">
          {/* ── Left: Show picker ── */}
          <aside className="al-sidebar">
            <div className="al-sidebar-head">
              <h2>Show Hari Ini</h2>
              <button
                className="al-btn-ghost sm"
                onClick={fetchShows}
                disabled={showsLoading}
                title="Refresh"
              >
                {showsLoading ? <span className="al-spin sm" /> : "↻"}
              </button>
            </div>

            {showsError && <div className="al-error">{showsError}</div>}

            {showsLoading && !shows.length && (
              <div className="al-placeholder">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="al-skeleton" style={{ height: 80, marginBottom: 10 }} />
                ))}
              </div>
            )}

            {!showsLoading && !shows.length && !showsError && (
              <div className="al-empty">Tidak ada show ditemukan untuk hari ini.</div>
            )}

            <div className="al-show-list">
              {shows.map((item) => {
                const isActive  = item.slug === selectedSlug;
                const schedDate = tsToDate(item.scheduled_at || item.live_at);
                const timeStr   = schedDate
                  ? new Date(schedDate.getTime() + 7 * 3600 * 1000)
                      .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                  : "—";

                return (
                  <button
                    key={item.slug}
                    className={`al-show-card ${isActive ? "active" : ""}`}
                    onClick={() => { setSelectedSlug(item.slug); setSelectedShow(item); }}
                  >
                    <img
                      src={item.image_url || item.creator?.image_url}
                      alt={item.title}
                      className="al-show-thumb"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <div className="al-show-info">
                      <span className="al-show-title">{item.title}</span>
                      <span className="al-show-meta">
                        <span className={`al-dot ${item.status}`} />
                        {item.status === "live"
                          ? "LIVE"
                          : item.status === "scheduled"
                          ? `⏰ ${timeStr}`
                          : item.status}
                      </span>
                      <span className="al-show-slug">{item.slug}</span>
                    </div>
                    {isActive && <span className="al-active-indicator">▶</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── Right: Player ── */}
          <main className="al-main">
            {!selectedSlug ? (
              <div className="al-no-select">
                <span style={{ fontSize: 48 }}>📺</span>
                <p>Pilih show dari daftar untuk mulai streaming</p>
              </div>
            ) : (
              <>
                {/* Show metadata */}
                {selectedShow && (
                  <div className="al-meta-bar">
                    <img
                      src={selectedShow.creator?.image_url}
                      alt=""
                      className="al-creator-img"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <div>
                      <h1 className="al-stream-title">{selectedShow.title}</h1>
                      <span className="al-stream-sub">
                        {selectedShow.creator?.name} &nbsp;·&nbsp;
                        <span className={`al-dot ${selectedShow.status}`} />
                        {selectedShow.status?.toUpperCase()}
                        {selectedShow.view_count > 0 && ` · 👁 ${selectedShow.view_count}`}
                      </span>
                    </div>
                    <div className="al-price-badge">
                      {selectedShow.idnliveplus?.liveroom_price ?? "—"} 🪙
                    </div>
                  </div>
                )}

                {/* Player area */}
                <div className="al-player-wrap">
                  {streamLoading && (
                    <div className="al-stream-loading">
                      <div className="al-spin xl" />
                      <p>Mengambil stream URL…</p>
                    </div>
                  )}
                  {!streamLoading && streamError && (
                    <div className="al-stream-err">
                      <span style={{ fontSize: 36 }}>⚠️</span>
                      <p>{streamError}</p>
                      <button
                        className="al-btn-primary sm"
                        onClick={() => {
                          const slug = selectedSlug;
                          setSelectedSlug(null);
                          setTimeout(() => setSelectedSlug(slug), 50);
                        }}
                      >
                        Coba Lagi
                      </button>
                    </div>
                  )}
                  {!streamLoading && !streamError && streamData && (
                    streamData.url ? (
                      <HLSPlayer
                        src={streamData.url}
                        title={selectedShow?.title || selectedSlug}
                      />
                    ) : (
                      <div className="al-stream-err">
                        <span style={{ fontSize: 36 }}>📭</span>
                        <p>Stream URL tidak tersedia untuk show ini.</p>
                        <span style={{ color: "#555", fontSize: 12 }}>
                          Status: {selectedShow?.status}
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Quality chips */}
                {streamData?.streams?.length > 1 && (
                  <div className="al-quality-row">
                    <span className="al-quality-label">Kualitas tersedia:</span>
                    {streamData.streams.map((s) => (
                      <span key={s["GROUP-ID"] || s.NAME} className="al-quality-chip">
                        {s.NAME}
                        {s.BANDWIDTH && s.BANDWIDTH !== "0" && (
                          <em> {Math.round(Number(s.BANDWIDTH) / 1000)}k</em>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Session info (broadcast id, stream time, etc.) */}
                {streamData?.session && Object.keys(streamData.session).length > 0 && (
                  <div className="al-session-row">
                    {["BROADCAST-ID", "VIDEO-SESSION-ID", "STREAM-TIME", "CLUSTER", "USER-COUNTRY"].map((key) =>
                      streamData.session[key] ? (
                        <span key={key} className="al-session-chip">
                          <em>{key}:</em> {streamData.session[key]}
                        </span>
                      ) : null
                    )}
                  </div>
                )}

                {/* Slug display */}
                <div className="al-slug-row">
                  <span className="al-slug-label">Slug:</span>
                  <code className="al-slug-code">{selectedSlug}</code>
                  <button
                    className="al-btn-ghost sm"
                    onClick={() => navigator.clipboard?.writeText(selectedSlug)}
                    title="Copy slug"
                  >
                    📋
                  </button>
                </div>

                {/* Description */}
                {selectedShow?.idnliveplus?.description && (
                  <div className="al-desc">
                    <h4>Deskripsi</h4>
                    <p>{selectedShow.idnliveplus.description}</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red:     #DC1F2E;
    --red-dim: #DC1F2E22;
    --red-mid: #DC1F2E55;
    --bg:      #080808;
    --bg2:     #111111;
    --bg3:     #181818;
    --bg4:     #222222;
    --line:    #2a2a2a;
    --txt:     #e8e8e8;
    --txt2:    #888;
    --txt3:    #444;
    --mono:    'DM Mono', monospace;
    --sans:    'Inter', sans-serif;
    --display: 'Syne', sans-serif;
  }

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes pulse  { 0%,100% { opacity:1 } 50% { opacity:.4 } }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  .al-noise {
    pointer-events: none;
    position: fixed; inset: 0; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    background-size: 200px;
    opacity: .5;
  }

  /* ── LOGIN ── */
  .al-login-bg {
    min-height: 100vh;
    background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--sans);
    position: relative;
  }
  .al-login-bg::before {
    content: '';
    position: fixed; inset: 0;
    background: radial-gradient(ellipse 60% 50% at 50% 50%, #DC1F2E0a 0%, transparent 70%);
    pointer-events: none;
  }
  .al-login-card {
    position: relative; z-index: 1;
    width: min(420px, 92vw);
    background: var(--bg2);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 40px 36px;
    animation: fadeIn .5s ease;
    box-shadow: 0 32px 80px #00000088, 0 0 0 1px #ffffff06 inset;
  }
  .al-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .al-logo-icon { font-size: 28px; color: var(--red); filter: drop-shadow(0 0 8px var(--red)); }
  .al-logo-icon.sm { font-size: 18px; }
  .al-logo-text { font-family: var(--display); font-size: 22px; font-weight: 800; color: var(--txt); letter-spacing: 3px; }
  .al-logo-text em { color: var(--red); font-style: normal; }
  .al-login-sub { color: var(--txt3); font-size: 12px; letter-spacing: 1px; margin-bottom: 32px; }
  .al-form { display: flex; flex-direction: column; gap: 16px; }
  .al-field { display: flex; flex-direction: column; gap: 6px; }
  .al-field label { font-size: 11px; font-weight: 600; color: var(--txt2); letter-spacing: 1.5px; text-transform: uppercase; }
  .al-field input {
    background: var(--bg3); border: 1px solid var(--line); border-radius: 8px;
    padding: 11px 14px; color: var(--txt); font-size: 14px; font-family: var(--sans);
    outline: none; transition: border-color .2s, box-shadow .2s;
  }
  .al-field input:focus { border-color: var(--red-mid); box-shadow: 0 0 0 3px var(--red-dim); }
  .al-error { background: #DC1F2E18; border: 1px solid #DC1F2E44; color: #ff6b6b; font-size: 13px; border-radius: 8px; padding: 10px 14px; }

  /* ── BUTTONS ── */
  .al-btn-primary {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--red); color: #fff; border: none; border-radius: 8px;
    padding: 12px 20px; font-size: 13px; font-weight: 700; letter-spacing: 2px;
    cursor: pointer; font-family: var(--display);
    transition: opacity .2s, transform .1s;
  }
  .al-btn-primary:hover { opacity: .88; }
  .al-btn-primary:active { transform: scale(.98); }
  .al-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .al-btn-primary.sm { padding: 8px 14px; font-size: 12px; }
  .al-btn-ghost {
    background: transparent; border: 1px solid var(--line); color: var(--txt2);
    border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer;
    transition: border-color .2s, color .2s; font-family: var(--sans);
  }
  .al-btn-ghost:hover { border-color: var(--txt3); color: var(--txt); }
  .al-btn-ghost.sm { padding: 5px 10px; font-size: 12px; }
  .al-btn-danger {
    background: transparent; border: 1px solid #DC1F2E44; color: var(--red);
    border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer;
    transition: background .2s; font-family: var(--sans);
  }
  .al-btn-danger:hover { background: var(--red-dim); }

  /* ── SPINNERS ── */
  .al-spin {
    display: inline-block; width: 18px; height: 18px;
    border: 2px solid #ffffff33; border-top-color: #fff;
    border-radius: 50%; animation: spin .7s linear infinite;
  }
  .al-spin.sm  { width: 13px; height: 13px; }
  .al-spin.xl  { width: 40px; height: 40px; border-width: 3px; border-top-color: var(--red); border-color: var(--red-dim); }

  /* ── DASHBOARD ── */
  .al-dashboard {
    min-height: 100vh; background: var(--bg);
    font-family: var(--sans); color: var(--txt);
    position: relative; display: flex; flex-direction: column;
  }
  .al-header {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; height: 56px;
    background: var(--bg2); border-bottom: 1px solid var(--line);
    backdrop-filter: blur(12px);
  }
  .al-header-left { display: flex; align-items: center; gap: 10px; }
  .al-header-title { font-family: var(--display); font-size: 15px; font-weight: 800; letter-spacing: 3px; color: var(--txt); }
  .al-badge { background: var(--red); color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; padding: 2px 7px; border-radius: 4px; }
  .al-header-right { display: flex; align-items: center; gap: 10px; }
  .al-today { color: var(--txt2); font-size: 12px; font-family: var(--mono); }

  .al-content { flex: 1; display: flex; position: relative; z-index: 1; }

  /* ── SIDEBAR ── */
  .al-sidebar {
    width: 320px; min-width: 280px;
    background: var(--bg2); border-right: 1px solid var(--line);
    display: flex; flex-direction: column;
    padding: 20px 16px; overflow-y: auto;
    max-height: calc(100vh - 56px);
    position: sticky; top: 56px; gap: 12px;
  }
  .al-sidebar-head { display: flex; align-items: center; justify-content: space-between; }
  .al-sidebar-head h2 { font-family: var(--display); font-size: 14px; font-weight: 800; letter-spacing: 2px; color: var(--txt2); text-transform: uppercase; }
  .al-show-list { display: flex; flex-direction: column; gap: 8px; }
  .al-show-card {
    display: flex; align-items: flex-start; gap: 10px;
    background: var(--bg3); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px; cursor: pointer; text-align: left;
    transition: border-color .2s, background .2s;
    position: relative; width: 100%;
  }
  .al-show-card:hover { border-color: var(--txt3); background: var(--bg4); }
  .al-show-card.active { border-color: var(--red-mid); background: var(--red-dim); }
  .al-show-thumb { width: 56px; height: 40px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: var(--bg4); }
  .al-show-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .al-show-title { font-size: 12px; font-weight: 600; color: var(--txt); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .al-show-meta { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--txt2); font-family: var(--mono); }
  .al-show-slug { font-family: var(--mono); font-size: 9px; color: var(--txt3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .al-active-indicator { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--red); font-size: 10px; }

  .al-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .al-dot.live      { background: #22c55e; animation: pulse 1.5s infinite; }
  .al-dot.scheduled { background: #f59e0b; }
  .al-dot.ended     { background: #555; }

  .al-skeleton {
    background: linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%);
    background-size: 400px 100%; animation: shimmer 1.4s infinite linear; border-radius: 8px;
  }
  .al-empty { color: var(--txt3); font-size: 13px; text-align: center; padding: 24px 0; }

  /* ── MAIN ── */
  .al-main { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; animation: fadeIn .3s ease; }
  .al-no-select { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--txt3); font-size: 15px; text-align: center; padding: 60px 0; }

  .al-meta-bar { display: flex; align-items: center; gap: 14px; background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; }
  .al-creator-img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--line); }
  .al-stream-title { font-family: var(--display); font-size: 16px; font-weight: 800; color: var(--txt); line-height: 1.2; }
  .al-stream-sub { display: flex; align-items: center; gap: 6px; color: var(--txt2); font-size: 12px; font-family: var(--mono); margin-top: 4px; }
  .al-price-badge { margin-left: auto; flex-shrink: 0; background: #f59e0b22; border: 1px solid #f59e0b44; color: #f59e0b; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; font-family: var(--mono); }

  .al-player-wrap { border-radius: 12px; overflow: hidden; background: #000; border: 1px solid var(--line); min-height: 200px; position: relative; }
  .al-stream-loading, .al-stream-err { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--txt2); font-size: 14px; background: var(--bg3); }

  /* Quality */
  .al-quality-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .al-quality-label { color: var(--txt3); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .al-quality-chip { background: var(--bg3); border: 1px solid var(--line); color: var(--txt2); font-size: 11px; padding: 3px 10px; border-radius: 20px; font-family: var(--mono); }
  .al-quality-chip em { color: var(--txt3); font-style: normal; }

  /* Session info */
  .al-session-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .al-session-chip { background: var(--bg3); border: 1px solid var(--line); color: var(--txt2); font-size: 10px; padding: 2px 8px; border-radius: 4px; font-family: var(--mono); }
  .al-session-chip em { color: var(--txt3); font-style: normal; margin-right: 4px; }

  /* Slug */
  .al-slug-row { display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
  .al-slug-label { color: var(--txt3); font-size: 11px; flex-shrink: 0; }
  .al-slug-code { flex: 1; font-family: var(--mono); font-size: 12px; color: var(--txt2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Description */
  .al-desc { background: var(--bg2); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
  .al-desc h4 { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: var(--txt3); text-transform: uppercase; margin-bottom: 8px; }
  .al-desc p { font-size: 13px; color: var(--txt2); line-height: 1.7; white-space: pre-line; }

  /* Responsive */
  @media (max-width: 768px) {
    .al-content { flex-direction: column; }
    .al-sidebar { width: 100%; position: static; max-height: 280px; border-right: none; border-bottom: 1px solid var(--line); }
    .al-today { display: none; }
    .al-show-list { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
    .al-show-card { min-width: 200px; }
  }
`;
