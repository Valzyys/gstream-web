import { useEffect, useState, useRef, useCallback } from "react";
import "../styles/home.css";

// ── API Config ──────────────────────────────────────────────────────────────
const API_BASE = "https://v2.jkt48connect.com/api";
const API_KEY = "JKTCONNECT";
const MUX_API = `${API_BASE}/mux/live-streams?apikey=${API_KEY}&username=vzy&password=vzy`;
const IDN_PLUS_API = `${API_BASE}/jkt48/idnplus?apikey=${API_KEY}`;

// ══════════════════════════════════════════════════════════════════════════════
//  SVG ICONS (inline — zero dependencies)
// ══════════════════════════════════════════════════════════════════════════════
const Icons = {
  // Theater / Stage icon
  Theater: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10s3.5 4 10 4 10-4 10-4" />
      <path d="M2 10V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" />
      <path d="M2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10" />
      <path d="M12 14v4" />
    </svg>
  ),
  // TV / Monitor icon for Live
  Monitor: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  // Calendar icon
  Calendar: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  // Clock icon
  Clock: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  // User icon
  User: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  // Star icon (for IDN Plus badge)
  Star: ({ size = 12, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  // Coin / Gold icon
  Coin: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" />
      <path d="M15 9.5a3.5 3.5 0 0 0-6 0" />
      <path d="M9 14.5a3.5 3.5 0 0 0 6 0" />
    </svg>
  ),
  // Play icon
  Play: ({ size = 22, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  // Live dot (radio)
  Radio: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill={color} />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
    </svg>
  ),
  // Empty state / TV Off
  TvOff: ({ size = 48, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="2" y1="3" x2="22" y2="17" />
    </svg>
  ),
  // Curtain / empty show
  Curtain: ({ size = 48, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <path d="M2 4h20v2H2z" />
      <path d="M4 6c0 4 2 8 8 14" />
      <path d="M20 6c0 4-2 8-8 14" />
      <path d="M4 6v14" />
      <path d="M20 6v14" />
    </svg>
  ),
  // Chevron left
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Chevron right
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3L11 8L6 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
//  NEXT SHOW SECTION (IDN Plus)
// ══════════════════════════════════════════════════════════════════════════════
function NextShowSection() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const fetchShows = async () => {
      try {
        const res = await fetch(IDN_PLUS_API);
        const data = await res.json();
        if (data.status === 200 && data.data?.length > 0) {
          setShows(data.data);
        }
      } catch (e) {
        console.error("Error fetching IDN Plus shows:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchShows();
  }, []);

  // Find next scheduled show (prefer scheduled, then live, then first)
  const nextShow = shows.find((s) => s.status === "scheduled")
    || shows.find((s) => s.status === "live")
    || shows[0]
    || null;

  // Countdown timer
  useEffect(() => {
    if (!nextShow?.scheduled_at) return;
    const target = nextShow.scheduled_at * 1000;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
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
  }, [nextShow]);

  const formatDate = (ts) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
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
            <p className="section-subtitle">Jadwal show terdekat dari IDN Live Plus</p>
          </div>
        </div>
        {nextShow && (
          <span className={`section-badge ${nextShow.status === "live" ? "live-badge" : "count-badge"}`}>
            {nextShow.status === "live" ? (
              <><span className="pulse-dot"></span> LIVE NOW</>
            ) : (
              <><Icons.Calendar size={12} color="rgba(255,255,255,0.5)" /> {formatDate(nextShow.scheduled_at)}</>
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
                src={nextShow.image_url}
                alt={nextShow.title}
                onError={(e) => {
                  e.target.src = "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg";
                }}
              />
              <div className={`next-show-status-badge ${nextShow.status === "live" ? "live" : "scheduled"}`}>
                <span className="status-dot"></span>
                {nextShow.status === "live" ? "LIVE" : "SCHEDULED"}
              </div>
            </div>

            {/* Details */}
            <div className="next-show-details">
              <h3 className="next-show-name">{nextShow.title}</h3>

              {nextShow.idnliveplus?.description && (
                <p className="next-show-description">{nextShow.idnliveplus.description}</p>
              )}

              {/* Countdown */}
              {nextShow.scheduled_at && nextShow.status !== "live" && (
                <div className="next-show-countdown">
                  <div className="countdown-unit">
                    <div className="countdown-value">{String(countdown.days).padStart(2, "0")}</div>
                    <span className="countdown-label">Hari</span>
                  </div>
                  <span className="countdown-separator">:</span>
                  <div className="countdown-unit">
                    <div className="countdown-value">{String(countdown.hours).padStart(2, "0")}</div>
                    <span className="countdown-label">Jam</span>
                  </div>
                  <span className="countdown-separator">:</span>
                  <div className="countdown-unit">
                    <div className="countdown-value">{String(countdown.mins).padStart(2, "0")}</div>
                    <span className="countdown-label">Menit</span>
                  </div>
                  <span className="countdown-separator">:</span>
                  <div className="countdown-unit">
                    <div className="countdown-value">{String(countdown.secs).padStart(2, "0")}</div>
                    <span className="countdown-label">Detik</span>
                  </div>
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
                    <div className="meta-value">{formatTime(nextShow.scheduled_at)}</div>
                  </div>
                </div>

                <div className="next-show-meta-item">
                  <div className="meta-icon">
                    <Icons.User size={15} color="rgba(255,255,255,0.5)" />
                  </div>
                  <div>
                    <div className="meta-label">Creator</div>
                    <div className="meta-value">{nextShow.creator?.name || "JKT48"}</div>
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
              thumbnail: s.image_url || "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg",
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
                    : "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg",
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
          onError={(e) => {
            e.target.src = "https://res.cloudinary.com/haymzm4wp/image/upload/v1760105848/bi5ej2hgh0cc2uowu5xr.jpg";
          }}
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
//  HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════
function Home() {
  return (
    <div className="home-page">
      <div className="home-content">
        <HeroCarousel />
        <NextShowSection />
        <LiveShowsSection />
      </div>
    </div>
  );
}

export default Home;
