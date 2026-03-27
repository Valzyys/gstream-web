import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MuxPlayer from "@mux/mux-player-react";
import { createClient } from "@supabase/supabase-js"; // <-- Import Supabase
import "../styles/live-stream.css";

// ── KONFIGURASI SUPABASE ──────────────────────────────────────────────────────
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "https://mzxfuaoihgzxvokwarao.supabase.co";
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16eGZ1YW9paGd6eHZva3dhcmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDg0NjIsImV4cCI6MjA4OTk4NDQ2Mn0.OFYCkBFXCSfLn-wG94OHHKL5CX8T_BLrbDGPiBdPIog";
const supabase = createClient(supabaseUrl, supabaseKey);
// ─────────────────────────────────────────────────────────────────────────────

// ── DevTools Detection ────────────────────────────────────────────────────────
const API_BASE = "https://v2.jkt48connect.com/api/jkt48connect";
const API_KEY  = "JKTCONNECT";

// ── DevTools Detection ────────────────────────────────────────────────────────
function useDevToolsDetection() {
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const intervalRef = useRef(null);
  const thresholdRef = useRef(160);

  useEffect(() => {
    // Method 1: window size difference (most reliable)
    const checkBySize = () => {
      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      return widthDiff > thresholdRef.current || heightDiff > thresholdRef.current;
    };

    // Method 2: console timing trick
    let devtoolsOpenByConsole = false;
    const element = new Image();
    Object.defineProperty(element, "id", {
      get() {
        devtoolsOpenByConsole = true;
        return "";
      },
    });

    const detect = () => {
      devtoolsOpenByConsole = false;
      // trigger console getter trick
      console.log("%c", element);   // eslint-disable-line no-console
      console.clear();              // eslint-disable-line no-console

      const bySize    = checkBySize();
      const byConsole = devtoolsOpenByConsole;
      const detected  = bySize || byConsole;

      setDevToolsOpen((prev) => {
        if (prev !== detected) return detected;
        return prev;
      });
    };

    detect();
    intervalRef.current = setInterval(detect, 500);

    // Method 3: debugger timing
    const debuggerCheck = () => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const delta = performance.now() - start;
      if (delta > 100) setDevToolsOpen(true);
    };
    // run once
    debuggerCheck();

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  return devToolsOpen;
}

// ── DevTools Blocker UI ───────────────────────────────────────────────────────
function DevToolsBlocker() {
  // Stop any audio/video when this mounts
  useEffect(() => {
    document.querySelectorAll("video, audio").forEach((el) => {
      try { el.pause(); el.src = ""; } catch {}
    });
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#000",
      zIndex: 999999,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "16px",
      userSelect: "none",
    }}>
      <span style={{ fontSize: "52px" }}>🚫</span>
      <p style={{
        color: "#fff",
        fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
        fontWeight: 800,
        margin: 0,
        letterSpacing: "2px",
        textAlign: "center",
        padding: "0 24px",
      }}>
        Mau ngapain?
      </p>
      <p style={{
        color: "#555",
        fontSize: "13px",
        margin: 0,
        textAlign: "center",
        padding: "0 32px",
      }}>
        Tutup Developer Tools untuk melanjutkan.
      </p>
    </div>
  );
}
/** Ambil session login dari sessionStorage (sama seperti ProfilePage) */
const getSession = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem("userLogin") || localStorage.getItem("userLogin") || "null");
    if (d && d.isLoggedIn && d.token) return d;
    return null;
  } catch { return null; }
};

function LiveStream() {
  const { playbackId } = useParams();
  const navigate       = useNavigate();

  // ── DevTools guard ────────────────────────────────────────────────────────

  // ── Auth / membership state ───────────────────────────────────────────────
  const [membershipChecked,  setMembershipChecked]  = useState(false);
  const [hasMonthlymember,   setHasMonthlyMember]   = useState(false);
  const [membershipLoading,  setMembershipLoading]  = useState(true);

  // ── Verification state (fallback jika tidak punya membership) ────────────
  const [isVerified,        setIsVerified]        = useState(false);
  const [showVerification,  setShowVerification]  = useState(false);
  const [verificationData,  setVerificationData]  = useState({ email: "", code: "" });
  const [verificationError, setVerificationError] = useState("");
  const [verifying,         setVerifying]         = useState(false);
  const [clientIP,          setClientIP]          = useState("");

  // ── Stream state ──────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [streamData,     setStreamData]     = useState(null);
  const [showInfo,       setShowInfo]       = useState(null);
  const [members,        setMembers]        = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // ── CHAT STATE ────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [isChatLoggingIn, setIsChatLoggingIn] = useState(true);
  const chatEndRef = useRef(null);
  const channelRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fetchClientIP = async () => {
    try {
      const res  = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      setClientIP(data.ip);
      return data.ip;
    } catch { return "unknown"; }
  };

  // ── Step 1: Cek membership dari session login ─────────────────────────────
  const checkMembership = useCallback(async () => {
    setMembershipLoading(true);
    const session = getSession();

    if (!session) {
      setHasMonthlyMember(false);
      setMembershipChecked(true);
      setMembershipLoading(false);
      return false;
    }

    const uid   = session.user?.user_id;
    const token = session.token;

    if (!uid || !token) {
      setHasMonthlyMember(false);
      setMembershipChecked(true);
      setMembershipLoading(false);
      return false;
    }

    try {
      const res  = await fetch(
        `${API_BASE}/membership/status/${uid}?apikey=${API_KEY}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (
        data.status &&
        data.data?.is_active &&
        data.data?.membership_type === "monthly"
      ) {
        setHasMonthlyMember(true);
        setMembershipChecked(true);
        setMembershipLoading(false);
        return true;
      }
    } catch (e) {
      console.error("Error checking membership:", e);
    }

    setHasMonthlyMember(false);
    setMembershipChecked(true);
    setMembershipLoading(false);
    return false;
  }, []);

  // ── Verification code logic ───────────────────────────────────────────────
  const verifyAccess = async () => {
    if (!verificationData.email || !verificationData.code) {
      setVerificationError("Email dan code wajib diisi");
      return;
    }

    setVerifying(true);
    setVerificationError("");

    try {
      const ip = clientIP || (await fetchClientIP());

      const verifyResponse = await fetch(
        "https://v2.jkt48connect.com/api/codes/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:  verificationData.email,
            code:   verificationData.code,
            apikey: "JKTCONNECT",
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyData.status) {
        setVerificationError(verifyData.message || "Code tidak valid atau sudah kedaluwarsa");
        setVerifying(false);
        return;
      }

      const codeData = verifyData.data;

      if (!codeData.is_active) {
        setVerificationError("Code ini sudah tidak aktif");
        setVerifying(false);
        return;
      }

      const usageCount       = parseInt(codeData.usage_count) || 0;
      const usageLimit       = parseInt(codeData.usage_limit)  || 1;
      const hasUsageRemaining = usageCount < usageLimit;

      if (codeData.is_used && !hasUsageRemaining) {
        const listResponse = await fetch(
          `https://v2.jkt48connect.com/api/codes/list?email=${verificationData.email}&apikey=JKTCONNECT`
        );
        const listData = await listResponse.json();

        if (listData.status && listData.data.wotatokens) {
          const userCode = listData.data.wotatokens.find(
            (c) => c.code === verificationData.code
          );

          if (userCode) {
            if (
              userCode.ip_address &&
              userCode.ip_address !== "" &&
              userCode.ip_address !== ip
            ) {
              setVerificationError("Code ini sudah digunakan dari IP address yang berbeda");
              setVerifying(false);
              return;
            }

            const sessionData = {
              email:     verificationData.email,
              code:      verificationData.code,
              ip,
              timestamp: Date.now(),
              verified:  true,
            };
            localStorage.setItem("stream_verification", JSON.stringify(sessionData));
            setIsVerified(true);
            setShowVerification(false);
            setVerifying(false);
            return;
          }
        }

        setVerificationError("Code sudah tidak dapat digunakan");
        setVerifying(false);
        return;
      }

      const useResponse = await fetch(
        "https://v2.jkt48connect.com/api/codes/use",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:  verificationData.email,
            code:   verificationData.code,
            apikey: "JKTCONNECT",
          }),
        }
      );

      const useData = await useResponse.json();

      if (useData.status) {
        const sessionData = {
          email:     verificationData.email,
          code:      verificationData.code,
          ip,
          timestamp: Date.now(),
          verified:  true,
        };
        localStorage.setItem("stream_verification", JSON.stringify(sessionData));
        setIsVerified(true);
        setShowVerification(false);
        setVerifying(false);
      } else {
        setVerificationError(useData.message || "Gagal menggunakan code");
        setVerifying(false);
      }
    } catch {
      setVerificationError("Terjadi kesalahan saat verifikasi. Silakan coba lagi.");
      setVerifying(false);
    }
  };

  const checkExistingVerification = async () => {
    const stored = localStorage.getItem("stream_verification");
    if (!stored) { setShowVerification(true); return false; }

    try {
      const info = JSON.parse(stored);
      if (!info.verified || !info.timestamp) {
        localStorage.removeItem("stream_verification");
        setShowVerification(true);
        return false;
      }

      const hoursDiff = (Date.now() - info.timestamp) / (1000 * 60 * 60);
      if (hoursDiff > 5) {
        localStorage.removeItem("stream_verification");
        setShowVerification(true);
        return false;
      }

      const ip = await fetchClientIP();
      if (info.ip !== ip) {
        info.ip = ip;
        localStorage.setItem("stream_verification", JSON.stringify(info));
      }

      setIsVerified(true);
      setShowVerification(false);
      setVerificationData({ email: info.email, code: info.code });
      return true;
    } catch {
      localStorage.removeItem("stream_verification");
      setShowVerification(true);
      return false;
    }
  };

  // ── Stream helpers ────────────────────────────────────────────────────────
  const fetchNearestShow = async () => {
    try {
      const res  = await fetch("https://v2.jkt48connect.com/api/jkt48/theater?apikey=JKTCONNECT");
      const data = await res.json();

      if (data.theater?.length > 0) {
        const now = new Date();
        let nearestShow = null;
        let smallestDiff = Infinity;
        data.theater.forEach((show) => {
          const diff = Math.abs(new Date(show.date) - now);
          if (diff < smallestDiff) { smallestDiff = diff; nearestShow = show; }
        });
        return nearestShow;
      }
      return null;
    } catch { return null; }
  };

  const fetchShowMembers = async (showId) => {
    try {
      setLoadingMembers(true);
      const res  = await fetch(`https://v2.jkt48connect.com/api/jkt48/theater/${showId}?apikey=JKTCONNECT`);
      const data = await res.json();
      if (data.shows?.[0]?.members) setMembers(data.shows[0].members);
      setLoadingMembers(false);
    } catch { setLoadingMembers(false); }
  };

  const loadStreamData = async () => {
    try {
      setLoading(true);
      if (!playbackId) { setError("Playback ID tidak ditemukan"); setLoading(false); return; }

      const nearestShow = await fetchNearestShow();
      if (nearestShow) {
        setShowInfo({ title: nearestShow.title, showId: nearestShow.id });
        await fetchShowMembers(nearestShow.id);
      }

      setTimeout(() => {
        setStreamData({
          playbackId,
          title:    nearestShow ? nearestShow.title : "Live Stream JKT48",
          viewerId: "viewer-" + Date.now(),
        });
        setLoading(false);
      }, 500);
    } catch {
      setError("Terjadi kesalahan saat memuat stream. Silakan coba lagi.");
      setLoading(false);
    }
  };

  // ── Init & Auth Chat ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await fetchClientIP();

      // Cek membership monthly terlebih dahulu
      const hasMonthly = await checkMembership();

      if (hasMonthly) {
        setIsVerified(true);
        setShowVerification(false);
        loadStreamData();
      } else {
        const verified = await checkExistingVerification();
        if (verified) {
          loadStreamData();
        } else {
          setLoading(false);
        }
      }
    };

    init();

    // --- AUTO REGISTER & LOGIN CHAT DARI LOCALSTORAGE ---
   const initChatUser = async () => {
  setIsChatLoggingIn(true);
  let userData = null;

  try {
    const rawData =
      sessionStorage.getItem("userLogin") ||
      localStorage.getItem("userLogin");

    if (rawData) {
      const parsed = JSON.parse(rawData);

      if (parsed?.isLoggedIn && parsed?.token && parsed?.user?.user_id) {
        const uid   = parsed.user.user_id;
        const token = parsed.token;

        try {
          const res = await fetch(
            `${API_BASE}/profile/${uid}?apikey=${API_KEY}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const profileData = await res.json();

          if (profileData.status && profileData.data) {
            userData = profileData.data; // ✅ Data lengkap dari API profile
          } else {
            userData = parsed.user;
          }
        } catch {
          userData = parsed.user;
        }
      } else {
        userData = parsed?.user || parsed;
      }
    }
  } catch (e) {
    console.error("Error parsing user session", e);
  }

  if (userData && (userData.username || userData.full_name)) {
    const username = userData.username || userData.full_name;
    const email    = userData.email || `${username.replace(/\s+/g, '').toLowerCase()}@jkt48connect.local`;
    
    // ✅ Pakai userData.avatar (field dari API profile, sama seperti ProfilePage)
    // Fallback ke UI Avatars dengan warna merah JKT48Connect jika kosong
    const avatar_url = userData.avatar
      ? userData.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7b1c1c&color=fff`;

    try {
      // 1. Auto register ke chatstream
      await fetch(`${API_BASE}/chatstream/register?apikey=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:   username.toLowerCase(),
          email:      email,
          avatar_url: avatar_url,
        }),
      });

      // 2. Cek user di Supabase by username
      const { data: supabaseUser, error } = await supabase
        .from("dashboard_v2_users")
        .select("id, username, avatar_url, role, bluetick")
        .eq("username", username.toLowerCase())
        .single();

      if (!error && supabaseUser) {
        // ✅ Tidak cek is_verified — semua user yang login bisa chat
        // ✅ Override avatar_url dari Supabase dengan avatar dari API profile
        setChatUser({
          ...supabaseUser,
          avatar_url: avatar_url, // Pakai avatar dari profile API, bukan dari Supabase
        });
      } else {
        // ✅ Jika belum ada di Supabase pun, tetap bisa chat pakai data profile
        setChatUser({
          id:         userData.user_id || username,
          username:   username.toLowerCase(),
          avatar_url: avatar_url,
          role:       "member",
          bluetick:   false,
        });
      }
    } catch (e) {
      console.error("Gagal auto register/login chat", e);
    }
  }

  setIsChatLoggingIn(false);
};
    initChatUser();

    // --- SETUP SUPABASE REALTIME CHANNEL ---
    const channel = supabase.channel(`chat-${playbackId}`, {
  config: { broadcast: { ack: true } },
});

    channel
      .on("broadcast", { event: "pesan_baru" }, (response) => {
        const payload = response.payload;
        // Mencegah pesan duplikat akibat optimistic update
        setChatMessages((prev) => {
          const isExist = prev.some(msg => msg.timestamp === payload.timestamp && msg.username === payload.username);
          if (isExist) return prev;
          return [...prev, payload];
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isVerified && !streamData && membershipChecked) {
      loadStreamData();
    }
  }, [isVerified, membershipChecked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll otomatis chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── UI Handlers ───────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setVerificationData((prev) => ({ ...prev, [name]: value }));
    setVerificationError("");
  };

  const handleVerificationSubmit = (e) => { e.preventDefault(); verifyAccess(); };

  const goBack     = () => navigate(-1);

  const handleLogout = () => {
    localStorage.removeItem("stream_verification");
    setIsVerified(false);
    setShowVerification(true);
    setStreamData(null);
    setVerificationData({ email: "", code: "" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatUser) return;

    const payload = {
      user_id: chatUser.id,
      username: chatUser.username,
      avatar_url: chatUser.avatar_url || "https://ui-avatars.com/api/?name=" + chatUser.username,
      bluetick: chatUser.bluetick,
      role: chatUser.role,
      text_content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    // Optimistic Update (Langsung tampil di UI lokal)
    setChatMessages((prev) => [...prev, payload]);
    setChatInput("");

    // Broadcast ke Supabase Realtime
    await channelRef.current.send({
      type: "broadcast",
      event: "pesan_baru",
      payload: payload,
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DevTools aktif → tampilkan blocker, hentikan semua proses UI
  // ══════════════════════════════════════════════════════════════════════════


  // ── Membership loading ────────────────────────────────────────────────────
  if (membershipLoading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner-large"></div>
          <h2>Memeriksa akses...</h2>
          <p>Sedang memverifikasi membership kamu</p>
        </div>
      </div>
    );
  }

  // ── Verification screen ───────────────────────────────────────────────────
  if (showVerification && !isVerified) {
    return (
      <div className="verification-page">
        <div className="verification-container">
          <div className="verification-card">
            <h1>Verifikasi Akses</h1>
            <p>Masukkan email dan code untuk mengakses live stream</p>

            <form onSubmit={handleVerificationSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email" name="email"
                  value={verificationData.email}
                  onChange={handleInputChange}
                  placeholder="email@example.com" required
                />
              </div>

              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text" name="code"
                  value={verificationData.code}
                  onChange={handleInputChange}
                  placeholder="Masukkan code" required
                />
              </div>

              {verificationError && (
                <div className="error-message">{verificationError}</div>
              )}

              {verifying ? (
                <button type="button" className="verify-button" disabled>
                  <span className="spinner"></span> Memverifikasi...
                </button>
              ) : (
                <button type="submit" className="verify-button">
                  ✓ Verifikasi Akses
                </button>
              )}
            </form>

            <div className="verification-info">
              <p>!<strong>Informasi:</strong></p>
              <ul>
                <li>Code verifikasi hanya dapat digunakan sekali</li>
                <li>IP address akan dicatat untuk keamanan</li>
                <li>Akses berlaku selama 5 jam</li>
                <li>Session tetap aktif saat refresh halaman</li>
                <li>
                  Punya membership monthly?{" "}
                  <span
                    style={{ color: "#DC1F2E", cursor: "pointer", fontWeight: 700 }}
                    onClick={() => navigate("/login")}
                  >
                    Login di sini
                  </span>
                </li>
              </ul>
            </div>

            <button onClick={goBack} className="back-button">← Kembali</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner-large"></div>
          <h2>Memuat live stream...</h2>
          <p>Mengambil informasi show...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !streamData) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon"></div>
          <h2>Terjadi Kesalahan</h2>
          <p>{error || "Tidak dapat memuat live stream"}</p>
          <button onClick={goBack} className="back-button">← Kembali</button>
        </div>
      </div>
    );
  }

  // ── Stream (main) ─────────────────────────────────────────────────────────
  return (
    <div className="live-stream-page">
      {/* Header */}
      <div className="stream-header">
        <button onClick={goBack} className="back-btn">← Kembali</button>

        {showInfo && (
          <div className="show-title">
            <span>{showInfo.title}</span>
          </div>
        )}

        {!hasMonthlymember && (
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        )}

        {hasMonthlymember && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#DC1F2E18", border: "1px solid #DC1F2E40",
            borderRadius: "20px", padding: "4px 12px",
            fontSize: "12px", fontWeight: 700, color: "#DC1F2E",
          }}>
            ★ MONTHLY
          </div>
        )}
      </div>

      {/* ── LAYOUT STREAM & CHAT ── */}
      <div className="stream-layout">
        
        {/* KIRI: Player & Members */}
        <div className="main-content">
          {/* Player */}
          <div className="player-container">
            <MuxPlayer
              streamType="live"
              playbackId={streamData.playbackId}
              metadata={{
                video_title:    streamData.title,
                viewer_user_id: streamData.viewerId,
              }}
              autoPlay
            />
          </div>

          {/* Lineup Members */}
          {members.length > 0 && (
            <div className="members-section">
              <div className="members-header">
                <h3>Lineup Show</h3>
                <span className="member-count">{members.length} Member</span>
              </div>

              {loadingMembers ? (
                <div className="members-loading">
                  <div className="spinner"></div>
                  <p>Memuat lineup...</p>
                </div>
              ) : (
                <div className="members-grid">
                  {members.map((member) => (
                    <div key={member.id} className="member-card">
                      <img src={member.img} alt={member.name} />
                      <p>{member.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="stream-footer">
            <p>POWERED BY JKT48Connect</p>
          </div>
        </div>

        {/* KANAN: Sidebar Live Chat */}
        <div className="chat-sidebar">
          <div className="chat-header">
            <span>Live Chat</span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
              {chatMessages.length} Pesan
            </span>
          </div>

          <div className="chat-messages">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="chat-message">
                <img src={msg.avatar_url || "https://ui-avatars.com/api/?name=" + msg.username} alt="avatar" className="chat-avatar" />
                <div className="chat-message-content">
                  <div className="chat-username">
                    {msg.role && msg.role !== "member" && (
                      <span className="chat-role-badge">{msg.role}</span>
                    )}
                    {msg.username}
                    
                    {/* Bluetick Icon */}
                    {msg.bluetick && (
                      <span className="bluetick-icon" title="Verified" style={{ display: "inline-flex", marginLeft: "4px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.726 2.75 1.83 3.444-.06.315-.09.64-.09.966 0 2.21 1.71 3.998 3.918 3.998.53 0 1.04-.1 1.51-.282.825 1.155 2.15 1.924 3.63 1.924s2.805-.767 3.63-1.924c.47.182.98.282 1.51.282 2.21 0 3.918-1.79 3.918-4 0-.325-.03-.65-.09-.966 1.105-.694 1.83-1.984 1.83-3.444z" fill="#1DA1F2"/>
                          <path d="M10.42 16.273L6.46 12.31l1.41-1.414 2.55 2.548 6.42-6.42 1.414 1.415-7.834 7.834z" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="chat-text">{msg.text_content}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-container">
            {isChatLoggingIn ? (
              <div className="chat-disabled-overlay">Memuat info akun...</div>
            ) : chatUser ? (
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  placeholder={`Kirim sebagai ${chatUser.username}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="chat-input"
                  maxLength={200}
                />
                <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            ) : (
              <div className="chat-disabled-overlay">
                Hanya bisa melihat chat. <br/>
                <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Login JKT48Connect</a> untuk ikut komen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveStream;
