import { useEffect, useState, useRef, useCallback } from "react";
import "../styles/home.css";

// ── API Config ──────────────────────────────────────────────────────────────
const API_BASE = "https://v2.jkt48connect.com/api";
const API_KEY = "JKTCONNECT";
const MUX_API = `${API_BASE}/mux/live-streams?apikey=${API_KEY}&username=vzy&password=vzy`;
const IDN_PLUS_API = `${API_BASE}/jkt48/idnplus?apikey=${API_KEY}`;
const THEATER_API = `${API_BASE}/jkt48/theater?apikey=${API_KEY}`;
const RECENT_API = `${API_BASE}/jkt48/recent?apikey=${API_KEY}`;

// ── Type filter: hanya tampilkan SHOW dan EVENT dari theater ────────────────
const ALLOWED_THEATER_TYPES = ["SHOW", "EVENT"];

// ══════════════════════════════════════════════════════════════════════════════
//  SVG ICONS (inline — zero dependencies)
// ══════════════════════════════════════════════════════════════════════════════
const Icons = {
  Theater: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10s3.5 4 10 4 10-4 10-4" />
      <path d="M2 10V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" />
      <path d="M2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10" />
      <path d="M12 14v4" />
    </svg>
  ),
  Monitor: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  Calendar: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Clock: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  User: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Star: ({ size = 12, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  Coin: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" />
      <path d="M15 9.5a3.5 3.5 0 0 0-6 0" />
      <path d="M9 14.5a3.5 3.5 0 0 0 6 0" />
    </svg>
  ),
  Play: ({ size = 22, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Radio: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill={color} />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
    </svg>
  ),
  TvOff: ({ size = 48, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="2" y1="3" x2="22" y2="17" />
    </svg>
  ),
  Curtain: ({ size = 48, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <path d="M2 4h20v2H2z" />
      <path d="M4 6c0 4 2 8 8 14" />
      <path d="M20 6c0 4-2 8-8 14" />
      <path d="M4 6v14" />
      <path d="M20 6v14" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3L11 8L6 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ══════════════════════════════════════════════════════════════════════════════
//  HERO CAROUSEL
// ══════════════════════════════════════════════════════════════════════════════
function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const banners = [
    "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg",
    "https://res.cloudinary.com/haymzm4wp/image/upload/v1709811057/hjsfgaw0kf3fhxg677fs.jpg",
    "https://res.cloudinary.com/haymzm4wp/image/upload/v1709811568/hm6aztwojrngb6ryrdn9.png",
    "https://res.cloudinary.com/haymzm4wp/image/upload/v1746940686/gnzangtum7a8ygmk8hvj.jpg",
    "https://res.cloudinary.com/haymzm4wp/image/upload/v1746940449/zjdka1gtuuoc5gx9kkco.jpg",
  ];

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % banners.length);
    }, 6000);
  }, [banners.length]);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  const go = (dir) => {
    setCurrent((p) =>
      dir === "prev"
        ? p === 0 ? banners.length - 1 : p - 1
        : (p + 1) % banners.length
    );
    resetTimer();
  };

  return (
    <div className="hero-carousel fade-in-up">
      <div className="hero-carousel-inner">
        {banners.map((src, i) => (
          <div key={i} className={`hero-slide ${i === current ? "active" : ""}`}>
            <img src={src} alt={`Banner ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
          </div>
        ))}

        <button className="hero-arrow hero-arrow-left" onClick={() => go("prev")} aria-label="Previous">
          <Icons.ChevronLeft />
        </button>
        <button className="hero-arrow hero-arrow-right" onClick={() => go("next")} aria-label="Next">
          <Icons.ChevronRight />
        </button>

        <div className="hero-dots">
          {banners.map((_, i) => (
            <button
              key={i}
              className={`hero-dot ${i === current ? "active" : ""}`}
              onClick={() => { setCurrent(i); resetTimer(); }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPER: Normalisasi show dari kedua source ke format seragam
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_IMG =
  "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg";

function normalizeShow(show, src) {
  if (src === "idn") {
    return {
      id: show.slug || `idn-${show.id}`,
      title: show.title,
      description: show.idnliveplus?.description || null,
      status: show.status, // "scheduled" | "live"
      scheduledAt: show.scheduled_at ? show.scheduled_at * 1000 : null,
      image: show.image_url || DEFAULT_IMG,
      creator: show.creator?.name || "JKT48",
      type: null,
      referenceCode: null,
      isBirthday: false,
      birthdayMembers: [],
      source: "idn",
    };
  }

  // Theater: date "2026-04-09T17:00:00.000Z" + start_time "19:00:00"
  let scheduledAt = null;
  if (show.date && show.start_time) {
    const datePart = show.date.split("T")[0]; // "2026-04-09"
    scheduledAt = new Date(`${datePart}T${show.start_time}+07:00`).getTime();
  } else if (show.date) {
    scheduledAt = new Date(show.date).getTime();
  }

  const isPast = scheduledAt ? scheduledAt < Date.now() : false;

  return {
    id: show.link || `theater-${show.schedule_id}`,
    title: show.title,
    description: show.short_description || null,
    status: isPast ? "past" : "scheduled",
    scheduledAt,
    image: show.poster || show.banner || DEFAULT_IMG,
    creator: "JKT48",
    type: show.type || "SHOW",         // "SHOW" | "EVENT"
    referenceCode: show.reference_code || null,
    isBirthday: show.is_birthday_show || false,
    birthdayMembers: show.birthday_members || [],
    source: "theater",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  NEXT SHOW SECTION  (IDN Plus → Theater fallback, no duplicates)
// ══════════════════════════════════════════════════════════════════════════════
function NextShowSection() {
  const [shows, setShows] = useState([]);
  const [source, setSource] = useState(null); // "idn" | "theater"
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const fetchShows = async () => {
      try {
        // ── 1. Coba IDN Plus dulu ──────────────────────────────────────────
        let idnShows = [];
        try {
          const res = await fetch(IDN_PLUS_API);
          const data = await res.json();
          if (data.status === 200 && Array.isArray(data.data) && data.data.length > 0) {
            idnShows = data.data;
          }
        } catch (e) {
          console.error("Error fetching IDN Plus:", e);
        }

        if (idnShows.length > 0) {
          setShows(idnShows.map((s) => normalizeShow(s, "idn")));
          setSource("idn");
          return;
        }

        // ── 2. Fallback ke Theater ─────────────────────────────────────────
        let theaterShows = [];
        try {
          const res = await fetch(THEATER_API);
          const data = await res.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            theaterShows = data.data;
          }
        } catch (e) {
          console.error("Error fetching Theater:", e);
        }

        // Filter hanya SHOW dan EVENT, buang GENERAL dan tipe lain
        const filtered = theaterShows.filter((s) =>
          ALLOWED_THEATER_TYPES.includes((s.type || "").toUpperCase())
        );

        // Deduplication: key = title_lowercase + tanggal
        // (guard jika suatu saat IDN Plus partial return & theater juga ada)
        const idnKeys = new Set(
          idnShows.map((s) => {
            const d = s.scheduled_at
              ? new Date(s.scheduled_at * 1000).toDateString()
              : "";
            return `${(s.title || "").toLowerCase().trim()}|${d}`;
          })
        );

        const deduped = filtered.filter((s) => {
          const d = s.date ? new Date(s.date).toDateString() : "";
          const key = `${(s.title || "").toLowerCase().trim()}|${d}`;
          return !idnKeys.has(key);
        });

        setShows(deduped.map((s) => normalizeShow(s, "theater")));
        setSource("theater");
      } catch (e) {
        console.error("Error in fetchShows:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchShows();
  }, []);

  // ── Pilih show terdekat yang belum lewat ───────────────────────────────────
  const nextShow =
    shows.find((s) => s.status === "live") ||
    shows.find((s) => s.status === "scheduled" && s.scheduledAt && s.scheduledAt > Date.now()) ||
    shows.find((s) => s.status === "scheduled") ||
    shows[0] ||
    null;

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nextShow?.scheduledAt || nextShow.status === "live") return;
    const target = nextShow.scheduledAt;

    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [nextShow?.scheduledAt, nextShow?.status]);

  const formatDate = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return (
      new Date(ts).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  };

  // ── Label badge tipe show (theater only) ──────────────────────────────────
  const typeLabelColor = {
    SHOW: { bg: "rgba(220,31,46,0.15)", color: "#DC1F2E" },
    EVENT: { bg: "rgba(255,215,0,0.15)", color: "#FFD700" },
  };

  return (
    <div className="next-show-section fade-in-up-delay-1">
      {/* Section Header */}
      <div className="section-header">
        <div className="section-label">
          <div className="section-icon schedule">
            <Icons.Theater size={18} color="#FFD700" />
          </div>
          <div>
            <h2 className="section-title">Upcoming Show</h2>
            <p className="section-subtitle">
              {source === "theater"
                ? "Jadwal show terdekat dari JKT48 Theater"
                : "Jadwal show terdekat dari IDN Live Plus"}
            </p>
          </div>
        </div>
        {nextShow && (
          <span
            className={`section-badge ${
              nextShow.status === "live" ? "live-badge" : "count-badge"
            }`}
          >
            {nextShow.status === "live" ? (
              <>
                <span className="pulse-dot"></span> LIVE NOW
              </>
            ) : (
              <>
                <Icons.Calendar size={12} color="rgba(255,255,255,0.5)" />{" "}
                {formatDate(nextShow.scheduledAt)}
              </>
            )}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="next-show-skeleton">
          <div className="skeleton-spinner"></div>
          <p>Memuat jadwal show...</p>
        </div>
      ) : !nextShow ? (
        <div className="no-next-show">
          <Icons.Curtain size={52} color="rgba(255,255,255,0.5)" />
          <h4>Belum Ada Jadwal Show</h4>
          <p>Jadwal show akan muncul di sini saat tersedia.</p>
        </div>
      ) : (
        <div className="next-show-card">
          <div className="next-show-inner">
            {/* Poster */}
            <div className="next-show-poster">
              <img
                src={nextShow.image}
                alt={nextShow.title}
                onError={(e) => { e.target.src = DEFAULT_IMG; }}
              />
              <div
                className={`next-show-status-badge ${
                  nextShow.status === "live" ? "live" : "scheduled"
                }`}
              >
                <span className="status-dot"></span>
                {nextShow.status === "live" ? "LIVE" : "SCHEDULED"}
              </div>
            </div>

            {/* Details */}
            <div className="next-show-details">
              <h3 className="next-show-name">{nextShow.title}</h3>

              {/* Badge tipe show (theater only: SHOW / EVENT) */}
              {nextShow.source === "theater" && nextShow.type && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background:
                      typeLabelColor[nextShow.type]?.bg ||
                      "rgba(255,255,255,0.1)",
                    color:
                      typeLabelColor[nextShow.type]?.color ||
                      "rgba(255,255,255,0.7)",
                    display: "inline-block",
                    marginBottom: "8px",
                  }}
                >
                  {nextShow.type}
                  {nextShow.referenceCode
                    ? ` · ${nextShow.referenceCode}`
                    : ""}
                </span>
              )}

              {nextShow.description && (
                <p className="next-show-description">{nextShow.description}</p>
              )}

              {/* Birthday members (theater only) */}
              {nextShow.isBirthday &&
                nextShow.birthdayMembers?.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      margin: "8px 0",
                    }}
                  >
                    {nextShow.birthdayMembers.map((m) => (
                      <div
                        key={m.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "rgba(255,255,255,0.07)",
                          borderRadius: "999px",
                          padding: "4px 10px 4px 4px",
                          fontSize: "12px",
                        }}
                      >
                        <img
                          src={m.img_alt || m.img}
                          alt={m.name}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <span style={{ color: "rgba(255,255,255,0.85)" }}>
                          🎂 {m.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Countdown */}
              {nextShow.scheduledAt && nextShow.status !== "live" && (
                <div className="next-show-countdown">
                  {[
                    { val: countdown.days, label: "Hari" },
                    { val: countdown.hours, label: "Jam" },
                    { val: countdown.mins, label: "Menit" },
                    { val: countdown.secs, label: "Detik" },
                  ].map((u, i) => (
                    <div
                      key={u.label}
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      {i > 0 && (
                        <span className="countdown-separator">:</span>
                      )}
                      <div className="countdown-unit">
                        <div className="countdown-value">
                          {String(u.val).padStart(2, "0")}
                        </div>
                        <span className="countdown-label">{u.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Meta info */}
              <div className="next-show-meta">
                <div className="next-show-meta-item">
                  <div className="meta-icon">
                    <Icons.Clock size={15} color="rgba(255,255,255,0.5)" />
                  </div>
                  <div>
                    <div className="meta-label">Waktu</div>
                    <div className="meta-value">
                      {formatTime(nextShow.scheduledAt)}
                    </div>
                  </div>
                </div>

                <div className="next-show-meta-item">
                  <div className="meta-icon">
                    <Icons.User size={15} color="rgba(255,255,255,0.5)" />
                  </div>
                  <div>
                    <div className="meta-label">Creator</div>
                    <div className="meta-value">{nextShow.creator}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  LIVE SHOWS SECTION
// ══════════════════════════════════════════════════════════════════════════════
function LiveShowsSection() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveShows = useCallback(async () => {
    try {
      let liveShows = [];

      // Cek IDN Plus terlebih dahulu
      try {
        const resIdn = await fetch(IDN_PLUS_API);
        const resultIdn = await resIdn.json();
        if (resultIdn.status === 200 && resultIdn.data?.length > 0) {
          const activeIdn = resultIdn.data.filter((s) => s.status === "live");
          if (activeIdn.length > 0) {
            liveShows = activeIdn.map((s) => ({
              id: s.slug || `idn-${s.id}`,
              title: s.title || "Live Stream JKT48",
              host: s.creator?.name || "JKT48",
              thumbnail:
                s.image_url || DEFAULT_IMG,
              streamUrl: `/live/${s.slug}`,
              server: "idn",
            }));
          }
        }
      } catch (idnError) {
        console.error("Error fetching IDN Plus live:", idnError);
      }

      // Jika tidak ada live di IDN Plus, fallback ke MUX
      if (liveShows.length === 0) {
        try {
          const resMux = await fetch(MUX_API);
          const resultMux = await resMux.json();

          if (resultMux.success && resultMux.data?.data) {
            liveShows = resultMux.data.data
              .filter((s) => s.status === "active" && s.connected === true)
              .map((s) => {
                const now = new Date();
                const dd = String(now.getDate()).padStart(2, "0");
                const mm = String(now.getMonth() + 1).padStart(2, "0");
                const yy = String(now.getFullYear()).slice(-2);
                const playbackId = s.playback_ids?.[0]?.id || "";

                return {
                  id: s.id,
                  title: `Show ${dd}-${mm}-${yy}`,
                  host: "GStream Team",
                  thumbnail: playbackId
                    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`
                    : DEFAULT_IMG,
                  playbackId,
                  streamUrl: `/live/${playbackId}`,
                  server: "mux",
                };
              });
          }
        } catch (muxError) {
          console.error("Error fetching MUX live:", muxError);
        }
      }

      setShows(liveShows);
    } catch (e) {
      console.error("Error fetching live shows:", e);
      setShows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLiveShows(); }, [fetchLiveShows]);
  useEffect(() => {
    const iv = setInterval(fetchLiveShows, 30000);
    return () => clearInterval(iv);
  }, [fetchLiveShows]);

  return (
    <div className="live-section fade-in-up-delay-2">
      {/* Header */}
      <div className="section-header">
        <div className="section-label">
          <div className="section-icon live">
            <Icons.Monitor size={18} color="#DC1F2E" />
          </div>
          <div>
            <h2 className="section-title">Live Shows</h2>
            <p className="section-subtitle">Streaming show JKT48 secara langsung</p>
          </div>
        </div>
        {shows.length > 0 && (
          <span className="section-badge live-badge">
            <span className="pulse-dot"></span>
            {shows.length} LIVE
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="section-loading">
          <div className="loading-spinner"></div>
          <p>Mencari live stream...</p>
        </div>
      ) : shows.length === 0 ? (
        <div className="no-live-state">
          <Icons.TvOff size={52} color="rgba(255,255,255,0.5)" />
          <h3>Tidak Ada Live Show</h3>
          <p>Belum ada show yang sedang live saat ini. Cek kembali nanti!</p>
        </div>
      ) : (
        <div className="live-grid">
          {shows.map((show) => (
            <StreamCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stream Card ─────────────────────────────────────────────────────────────
function StreamCard({ show }) {
  const handleClick = () => {
    window.location.href = show.streamUrl;
  };

  return (
    <div className="stream-card" onClick={handleClick}>
      <div className="stream-card-thumb">
        <img
          src={show.thumbnail}
          alt={show.title}
          onError={(e) => { e.target.src = DEFAULT_IMG; }}
        />

        <div className="stream-live-pill">
          <span className="pill-dot"></span>
          LIVE
        </div>

        <div className="stream-play-overlay">
          <div className="stream-play-btn">
            <Icons.Play size={22} />
          </div>
        </div>
      </div>

      <div className="stream-card-info">
        <h3 className="stream-card-title">{show.title}</h3>
        <p className="stream-card-host">
          <Icons.User size={13} color="rgba(255,255,255,0.4)" />
          {show.host}
        </p>
        <button className="stream-watch-btn is-live" onClick={handleClick}>
          Watch Live
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  RECENT LIVE SECTION (MARQUEE)
// ══════════════════════════════════════════════════════════════════════════════
function RecentLiveSection() {
  const [recentShows, setRecentShows] = useState([]);

  useEffect(() => {
    fetch(RECENT_API)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Duplicate array to ensure seamless marquee rolling even if few items
          setRecentShows([...data, ...data]);
        }
      })
      .catch((err) => console.error("Error fetching recent live:", err));
  }, []);

  if (recentShows.length === 0) return null;

  return (
    <div className="recent-live-section fade-in-up-delay-2">
      <div className="recent-live-header">
        <div className="section-icon live">
          <Icons.Radio size={16} color="#ff4757" />
        </div>
        <h3 className="section-title">Recent Member Live</h3>
      </div>
      <div className="recent-live-marquee">
        {recentShows.map((show, idx) => (
          <div key={`${show._id}-${idx}`} className="recent-member-card">
            <img
              className="recent-member-avatar"
              src={show.member?.img_alt || show.member?.img || DEFAULT_IMG}
              alt={show.member?.nickname || show.member?.name || "Member"}
              onError={(e) => { e.target.src = DEFAULT_IMG; }}
            />
            <div className="recent-member-info">
              <h4 className="recent-member-name">
                {show.member?.nickname || show.member?.name?.split('/')[0] || "JKT48"}
              </h4>
              <p className="recent-member-meta">
                <span className={`recent-platform-badge ${show.type}`}>
                  {show.type === 'idn' ? 'IDN Live' : 'Showroom'}
                </span>
                <span style={{opacity: 0.6}}>•</span>
                <Icons.User size={10} color="rgba(255,255,255,0.5)" />
                {show.live_info?.viewers?.num?.toLocaleString('id-ID') || 0}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════
function Home() {
  return (
    <div className="home-page">
      <div className="home-content">
        <HeroCarousel />
        <NextShowSection />
        <LiveShowsSection />
        <RecentLiveSection />
      </div>
    </div>
  );
}

export default Home;
