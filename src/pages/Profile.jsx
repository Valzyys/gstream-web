import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://v2.jkt48connect.com/api/jkt48connect';
const API_KEY = 'JKTCONNECT';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const formatRelative = (s) => {
  if (!s) return '—';
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDate(s);
};

const getMembershipColor = (type) => {
  if (type === 'monthly') return '#DC1F2E';
  if (type === 'weekly') return '#F59E0B';
  if (type === 'ramadan') return '#7C3AED';
  return '#555';
};

const getMembershipLabel = (type) => {
  if (type === 'monthly') return 'MONTHLY';
  if (type === 'weekly') return 'WEEKLY';
  if (type === 'ramadan') return 'RAMADAN';
  return 'FREE';
};

const getOrderStatusColor = (status) => {
  if (status === 'paid') return '#2ECC71';
  if (status === 'pending') return '#F59E0B';
  if (status === 'failed' || status === 'expired') return '#DC1F2E';
  return '#555';
};

// ── Get session from storage ──────────────────────────────────────────────────
const getSession = () => {
  try {
    const data = JSON.parse(sessionStorage.getItem('userLogin') || 'null');
    if (data && data.isLoggedIn && data.token) return data;
    return null;
  } catch {
    return null;
  }
};

// ── ProfilePage ───────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const loadAll = useCallback(async () => {
    const s = getSession();
    if (!s) {
      navigate('/login');
      return;
    }
    setSession(s);

    const uid = s.user?.user_id;
    const token = s.token;

    if (!uid || !token) {
      navigate('/login');
      return;
    }

    try {
      const [profileRes, membershipRes, notifRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/profile/${uid}?apikey=${API_KEY}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/membership/status/${uid}?apikey=${API_KEY}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/notifications/${uid}?limit=10&apikey=${API_KEY}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/order/list/${uid}?limit=5&apikey=${API_KEY}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [pData, mData, nData, oData] = await Promise.all([
        profileRes.json(),
        membershipRes.json(),
        notifRes.json(),
        ordersRes.json(),
      ]);

      if (pData.status) setProfile(pData.data);
      if (mData.status) setMembership(mData.data);
      if (nData.status) {
        setNotifications(nData.data?.notifications || []);
        setUnreadCount(nData.data?.unread_count || 0);
      }
      if (oData.status) setOrders(oData.data?.orders || []);
    } catch (e) {
      showToast('Gagal memuat data profil. Periksa koneksi internet.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleLogout = async () => {
    if (!window.confirm('Apakah kamu yakin ingin logout?')) return;
    try {
      const s = getSession();
      if (s?.token) {
        await fetch(`${API_BASE}/auth/logout?apikey=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: s.token,
            user_id: s.user?.user_id,
          }),
        });
      }
    } catch {}
    sessionStorage.removeItem('userLogin');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('successfulRegistration');
    navigate('/');
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read?apikey=${API_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.token}` },
        body: JSON.stringify({ user_id: session?.user?.user_id, mark_all: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('Semua notifikasi ditandai dibaca');
    } catch {
      showToast('Gagal menandai notifikasi', 'error');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  if (loading) {
    return (
      <div className="pp-loading">
        <div className="pp-spinner" />
        <p>Memuat profil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pp-error">
        <div className="pp-error__icon">⚠️</div>
        <h2>Gagal Memuat Profil</h2>
        <p>Pastikan kamu sudah login dan koneksi internet tersedia.</p>
        <button className="pp-btn pp-btn--primary" onClick={() => navigate('/login')}>
          Kembali ke Login
        </button>
      </div>
    );
  }

  const isPremium = membership?.is_active && membership?.membership_type !== 'free';
  const memberColor = getMembershipColor(membership?.membership_type || 'free');
  const memberLabel = getMembershipLabel(membership?.membership_type || 'free');
  const initials = (profile.full_name || profile.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="pp-wrapper">
      {/* Toast */}
      {toast.show && (
        <div className={`pp-toast pp-toast--${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="pp-container">
        {/* ── HERO CARD ─────────────────────────────────────────────────── */}
        <div className="pp-hero">
          <div className="pp-hero__top">
            <div className="pp-hero__avatar-wrap">
              {profile.avatar ? (
                <img src={profile.avatar} alt="avatar" className="pp-hero__avatar-img" />
              ) : (
                <div className="pp-hero__avatar-initials">{initials}</div>
              )}
              {profile.is_verified && (
                <div className="pp-hero__verified-dot" title="Verified">✓</div>
              )}
            </div>
            <div className="pp-hero__info">
              <h1 className="pp-hero__name">{profile.full_name || profile.username}</h1>
              <p className="pp-hero__username">@{profile.username}</p>
              <div className="pp-hero__badges">
                <span
                  className="pp-badge"
                  style={{ color: memberColor, background: `${memberColor}18`, border: `1px solid ${memberColor}44` }}
                >
                  {isPremium ? `✦ ${memberLabel}` : 'Free Account'}
                </span>
                {profile.is_verified && (
                  <span className="pp-badge pp-badge--verified">✓ Verified</span>
                )}
              </div>
            </div>
            <div className="pp-hero__actions">
              <button className="pp-btn pp-btn--outline pp-btn--sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? '⟳ Memuat...' : '⟳ Refresh'}
              </button>
              <button className="pp-btn pp-btn--danger pp-btn--sm" onClick={handleLogout}>
                ⎋ Logout
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="pp-hero__stats">
            <div className="pp-hero__stat">
              <span className="pp-hero__stat-num">{profile.referral_code || '—'}</span>
              <span className="pp-hero__stat-label">Referral Code</span>
            </div>
            <div className="pp-hero__stat-divider" />
            <div className="pp-hero__stat">
              <span className="pp-hero__stat-num" style={{ color: isPremium ? memberColor : '#555' }}>
                {isPremium ? `${membership.days_remaining} hari` : '—'}
              </span>
              <span className="pp-hero__stat-label">Sisa Membership</span>
            </div>
            <div className="pp-hero__stat-divider" />
            <div className="pp-hero__stat">
              <span className="pp-hero__stat-num" style={{ color: profile.is_verified ? '#2ECC71' : '#888' }}>
                {profile.is_verified ? 'Verified' : 'Unverified'}
              </span>
              <span className="pp-hero__stat-label">Status Email</span>
            </div>
          </div>
        </div>

        {/* ── TABS ──────────────────────────────────────────────────────── */}
        <div className="pp-tabs">
          {['profile', 'membership', 'orders', 'notifications'].map((tab) => (
            <button
              key={tab}
              className={`pp-tab ${activeTab === tab ? 'pp-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'profile' && '👤 Profil'}
              {tab === 'membership' && '⭐ Membership'}
              {tab === 'orders' && '🛒 Order'}
              {tab === 'notifications' && (
                <>🔔 Notifikasi {unreadCount > 0 && <span className="pp-tab-badge">{unreadCount}</span>}</>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: PROFILE ──────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="pp-grid">
            <div className="pp-col">
              {/* Personal Info */}
              <div className="pp-card">
                <h2 className="pp-card__title">Informasi Pribadi</h2>
                <div className="pp-info-list">
                  <div className="pp-info-row">
                    <span className="pp-info-label">👤 Username</span>
                    <span className="pp-info-value">{profile.username}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">📛 Nama Lengkap</span>
                    <span className="pp-info-value">{profile.full_name || '—'}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">✉️ Email</span>
                    <span className="pp-info-value">{profile.email || '—'}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">📱 No. HP</span>
                    <span className="pp-info-value">{profile.phone || 'Belum diisi'}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">🎁 Referral</span>
                    <span className="pp-info-value pp-info-value--mono">{profile.referral_code || '—'}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">📅 Bergabung</span>
                    <span className="pp-info-value">{formatDate(profile.created_at)}</span>
                  </div>
                  {profile.last_login && (
                    <div className="pp-info-row">
                      <span className="pp-info-label">🕐 Login Terakhir</span>
                      <span className="pp-info-value">{formatRelative(profile.last_login)}</span>
                    </div>
                  )}
                  <div className="pp-info-row">
                    <span className="pp-info-label">✅ Status Akun</span>
                    <span className="pp-info-value" style={{ color: profile.is_active ? '#2ECC71' : '#DC1F2E' }}>
                      {profile.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="pp-col pp-col--sidebar">
              <div className="pp-card">
                <h3 className="pp-card__subtitle">Status Membership</h3>
                {isPremium ? (
                  <>
                    <div className="pp-membership-badge" style={{ background: `${memberColor}18`, borderColor: `${memberColor}44`, color: memberColor }}>
                      ✦ {memberLabel} · Aktif
                    </div>
                    <div className="pp-info-list" style={{ marginTop: 12 }}>
                      <div className="pp-info-row">
                        <span className="pp-info-label">Mulai</span>
                        <span className="pp-info-value">{formatDate(membership.membership_started_at)}</span>
                      </div>
                      <div className="pp-info-row">
                        <span className="pp-info-label">Berakhir</span>
                        <span className="pp-info-value">{formatDate(membership.membership_expired_at)}</span>
                      </div>
                      <div className="pp-info-row">
                        <span className="pp-info-label">Sisa</span>
                        <span className="pp-info-value" style={{ color: memberColor, fontWeight: 700 }}>
                          {membership.days_remaining} hari
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="pp-free-box">
                    <p>Akun Free — upgrade untuk akses semua livestream</p>
                    <button className="pp-btn pp-btn--primary" style={{ marginTop: 10, width: '100%' }}
                      onClick={() => navigate('/membership')}>
                      ⚡ Upgrade Sekarang
                    </button>
                  </div>
                )}
              </div>

              <div className="pp-card">
                <h3 className="pp-card__subtitle">User ID</h3>
                <p className="pp-user-id">{profile.user_id}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: MEMBERSHIP ───────────────────────────────────────────── */}
        {activeTab === 'membership' && (
          <div className="pp-card">
            <h2 className="pp-card__title">Status Membership</h2>
            {isPremium ? (
              <>
                <div className="pp-membership-hero" style={{ borderColor: `${memberColor}44`, background: `${memberColor}09` }}>
                  <div className="pp-membership-hero__type" style={{ color: memberColor }}>✦ {memberLabel}</div>
                  <div className="pp-membership-hero__days" style={{ color: memberColor }}>
                    {membership.days_remaining}
                    <span>hari tersisa</span>
                  </div>
                  <div className="pp-membership-progress-wrap">
                    <div className="pp-membership-progress" style={{ backgroundColor: `${memberColor}22` }}>
                      <div className="pp-membership-progress__fill"
                        style={{ backgroundColor: memberColor, width: `${Math.min(100, (membership.days_remaining / 30) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="pp-info-list" style={{ marginTop: 16 }}>
                  <div className="pp-info-row">
                    <span className="pp-info-label">📅 Mulai</span>
                    <span className="pp-info-value">{formatDate(membership.membership_started_at)}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">📅 Berakhir</span>
                    <span className="pp-info-value">{formatDate(membership.membership_expired_at)}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">🔖 Tipe</span>
                    <span className="pp-info-value" style={{ color: memberColor, fontWeight: 700 }}>{memberLabel}</span>
                  </div>
                  <div className="pp-info-row">
                    <span className="pp-info-label">✅ Status</span>
                    <span className="pp-info-value" style={{ color: '#2ECC71' }}>Aktif</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="pp-free-box">
                <div className="pp-free-box__icon">⭐</div>
                <h3>Akun Free</h3>
                <p>Upgrade ke Membership untuk akses semua livestream theater & event JKT48 tanpa batas.</p>
                <button className="pp-btn pp-btn--primary pp-btn--lg" onClick={() => navigate('/membership')}>
                  ⚡ Upgrade Membership
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ORDERS ───────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="pp-card">
            <h2 className="pp-card__title">Riwayat Order</h2>
            {orders.length === 0 ? (
              <div className="pp-empty">
                <span>🛒</span>
                <p>Belum ada order</p>
              </div>
            ) : (
              <div className="pp-order-list">
                {orders.map((o) => (
                  <div key={o.order_id} className="pp-order-item">
                    <div className="pp-order-item__left">
                      <p className="pp-order-item__plan">{o.plan_name}</p>
                      <p className="pp-order-item__id">#{o.order_id.slice(-10)}</p>
                      <p className="pp-order-item__date">{formatRelative(o.created_at)}</p>
                      {o.membership_expired_at && (
                        <p className="pp-order-item__exp">Exp: {formatDate(o.membership_expired_at)}</p>
                      )}
                    </div>
                    <div className="pp-order-item__right">
                      <p className="pp-order-item__amount">
                        Rp{Number(o.final_amount).toLocaleString('id-ID')}
                      </p>
                      <span
                        className="pp-order-item__status"
                        style={{ color: getOrderStatusColor(o.status), background: `${getOrderStatusColor(o.status)}18`, border: `1px solid ${getOrderStatusColor(o.status)}44` }}
                      >
                        {o.status.toUpperCase()}
                      </span>
                      {o.paid_at && (
                        <p className="pp-order-item__paid">Dibayar: {formatRelative(o.paid_at)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: NOTIFICATIONS ────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="pp-card">
            <div className="pp-card__header">
              <h2 className="pp-card__title">Notifikasi</h2>
              {unreadCount > 0 && (
                <button className="pp-btn pp-btn--outline pp-btn--sm" onClick={markAllRead}>
                  ✓ Tandai semua dibaca
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="pp-empty">
                <span>🔔</span>
                <p>Belum ada notifikasi</p>
              </div>
            ) : (
              <div className="pp-notif-list">
                {notifications.map((n) => (
                  <div key={n.id} className={`pp-notif-item ${!n.is_read ? 'pp-notif-item--unread' : ''}`}>
                    <div className="pp-notif-item__dot" style={{ background: n.is_read ? '#1e1e1e' : '#DC1F2E' }} />
                    <div className="pp-notif-item__body">
                      <p className="pp-notif-item__title">{n.title}</p>
                      <p className="pp-notif-item__msg">{n.message}</p>
                      <p className="pp-notif-item__time">{formatRelative(n.created_at)}</p>
                    </div>
                    <span className="pp-notif-item__type">{n.category || n.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        /* ── Reset & base ─────────────────────────────── */
        .pp-wrapper {
          min-height: 100vh;
          background: #f4f5f7;
          padding: 24px 16px 60px;
          box-sizing: border-box;
          font-family: inherit;
        }
        .pp-container {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Loading / Error ──────────────────────────── */
        .pp-loading, .pp-error {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: #f4f5f7;
          color: #333;
          text-align: center;
          padding: 24px;
        }
        .pp-spinner {
          width: 48px; height: 48px;
          border: 4px solid rgba(123,28,28,0.15);
          border-top: 4px solid #7b1c1c;
          border-radius: 50%;
          animation: ppSpin 0.8s linear infinite;
        }
        @keyframes ppSpin { to { transform: rotate(360deg); } }
        .pp-error__icon { font-size: 3rem; }

        /* ── Toast ────────────────────────────────────── */
        .pp-toast {
          position: fixed;
          top: 20px; right: 20px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          max-width: 400px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          animation: ppSlideIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55);
        }
        @keyframes ppSlideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .pp-toast--success { background: #d4edda; border: 1.5px solid #b1dfbb; color: #155724; }
        .pp-toast--error   { background: #f8d7da; border: 1.5px solid #f1b0b7; color: #721c24; }

        /* ── Hero ─────────────────────────────────────── */
        .pp-hero {
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
          overflow: hidden;
        }
        .pp-hero__top {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          flex-wrap: wrap;
        }
        .pp-hero__avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .pp-hero__avatar-img {
          width: 72px; height: 72px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #7b1c1c;
        }
        .pp-hero__avatar-initials {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7b1c1c, #6a1818);
          color: white;
          font-size: 1.6rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pp-hero__verified-dot {
          position: absolute;
          bottom: 2px; right: 2px;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: #2ECC71;
          color: white;
          font-size: 11px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }
        .pp-hero__info { flex: 1; min-width: 0; }
        .pp-hero__name { margin: 0 0 4px; font-size: 1.4rem; font-weight: 800; color: #111; }
        .pp-hero__username { margin: 0 0 8px; color: #888; font-size: 0.9rem; }
        .pp-hero__badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .pp-badge {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .pp-badge--verified { background: #dcfce7; color: #166534; border: 1px solid #b1dfbb; }
        .pp-hero__actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

        .pp-hero__stats {
          display: flex;
          align-items: center;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
        }
        .pp-hero__stat {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 8px;
          gap: 4px;
        }
        .pp-hero__stat-num {
          font-size: 14px;
          font-weight: 800;
          color: #111;
          font-family: monospace;
        }
        .pp-hero__stat-label { font-size: 11px; color: #888; }
        .pp-hero__stat-divider { width: 1px; height: 36px; background: #e5e7eb; }

        /* ── Tabs ─────────────────────────────────────── */
        .pp-tabs {
          display: flex;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          overflow: hidden;
          overflow-x: auto;
        }
        .pp-tab {
          flex: 1;
          padding: 14px 10px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 600;
          color: #888;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .pp-tab:hover { color: #7b1c1c; background: #fef2f2; }
        .pp-tab--active { color: #7b1c1c; border-bottom-color: #7b1c1c; background: #fef2f2; }
        .pp-tab-badge {
          background: #DC1F2E;
          color: white;
          border-radius: 10px;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 900;
          min-width: 18px;
          text-align: center;
        }

        /* ── Grid ─────────────────────────────────────── */
        .pp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .pp-grid { grid-template-columns: 2fr 1fr; }
        }
        .pp-col { display: flex; flex-direction: column; gap: 16px; }
        .pp-col--sidebar { display: flex; flex-direction: column; gap: 16px; }

        /* ── Card ─────────────────────────────────────── */
        .pp-card {
          background: white;
          border-radius: 14px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.07);
          padding: 20px;
        }
        .pp-card__title {
          font-size: 1rem;
          font-weight: 700;
          color: #111;
          margin: 0 0 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .pp-card__subtitle {
          font-size: 0.9rem;
          font-weight: 700;
          color: #333;
          margin: 0 0 12px;
        }
        .pp-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .pp-card__header .pp-card__title { margin: 0; padding: 0; border: none; }

        /* ── Info rows ────────────────────────────────── */
        .pp-info-list { display: flex; flex-direction: column; }
        .pp-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f5f5f5;
          gap: 12px;
        }
        .pp-info-row:last-child { border-bottom: none; }
        .pp-info-label { font-size: 13px; color: #888; flex-shrink: 0; }
        .pp-info-value { font-size: 13px; font-weight: 600; color: #111; text-align: right; word-break: break-all; }
        .pp-info-value--mono { font-family: monospace; letter-spacing: 1px; }

        /* ── Membership ───────────────────────────────── */
        .pp-membership-badge {
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid;
          font-weight: 800;
          font-size: 14px;
          text-align: center;
          letter-spacing: 0.5px;
        }
        .pp-membership-hero {
          border-radius: 12px;
          border: 1px solid;
          padding: 20px;
          text-align: center;
          margin-bottom: 4px;
        }
        .pp-membership-hero__type {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .pp-membership-hero__days {
          font-size: 3rem;
          font-weight: 900;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
        }
        .pp-membership-hero__days span { font-size: 1rem; font-weight: 600; }
        .pp-membership-progress-wrap { margin-top: 14px; }
        .pp-membership-progress {
          height: 6px;
          border-radius: 4px;
          overflow: hidden;
        }
        .pp-membership-progress__fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        /* ── Free box ─────────────────────────────────── */
        .pp-free-box {
          text-align: center;
          padding: 16px 0;
        }
        .pp-free-box__icon { font-size: 2.5rem; margin-bottom: 8px; }
        .pp-free-box h3 { margin: 0 0 8px; color: #333; }
        .pp-free-box p { color: #888; font-size: 13px; line-height: 1.6; margin: 0 0 12px; }

        /* ── Orders ───────────────────────────────────── */
        .pp-order-list { display: flex; flex-direction: column; gap: 2px; }
        .pp-order-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid #f5f5f5;
          gap: 12px;
        }
        .pp-order-item:last-child { border-bottom: none; }
        .pp-order-item__left { flex: 1; min-width: 0; }
        .pp-order-item__plan { font-weight: 700; color: #111; font-size: 14px; margin: 0 0 3px; }
        .pp-order-item__id  { font-size: 11px; color: #aaa; font-family: monospace; margin: 0 0 2px; }
        .pp-order-item__date { font-size: 11px; color: #bbb; margin: 0; }
        .pp-order-item__exp { font-size: 11px; color: #aaa; margin: 4px 0 0; }
        .pp-order-item__right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .pp-order-item__amount { font-weight: 800; font-size: 14px; color: #111; margin: 0; }
        .pp-order-item__status {
          font-size: 10px; font-weight: 800;
          padding: 2px 8px; border-radius: 6px;
          letter-spacing: 0.5px;
        }
        .pp-order-item__paid { font-size: 10px; color: #aaa; margin: 0; }

        /* ── Notifications ────────────────────────────── */
        .pp-notif-list { display: flex; flex-direction: column; }
        .pp-notif-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #f5f5f5;
        }
        .pp-notif-item:last-child { border-bottom: none; }
        .pp-notif-item--unread { background: #fff9f9; margin: 0 -20px; padding: 14px 20px; }
        .pp-notif-item__dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .pp-notif-item__body { flex: 1; min-width: 0; }
        .pp-notif-item__title { font-weight: 700; color: #111; font-size: 13px; margin: 0 0 4px; }
        .pp-notif-item__msg { color: #666; font-size: 12px; margin: 0 0 4px; line-height: 1.5; }
        .pp-notif-item__time { color: #bbb; font-size: 11px; margin: 0; }
        .pp-notif-item__type {
          font-size: 10px; color: #aaa;
          background: #f5f5f5;
          padding: 2px 8px;
          border-radius: 6px;
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: 4px;
        }

        /* ── User ID ──────────────────────────────────── */
        .pp-user-id {
          font-family: monospace;
          font-size: 12px;
          color: #888;
          word-break: break-all;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 8px;
          margin: 0;
        }

        /* ── Empty ────────────────────────────────────── */
        .pp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px;
          color: #bbb;
          font-size: 14px;
        }
        .pp-empty span { font-size: 2rem; }

        /* ── Buttons ──────────────────────────────────── */
        .pp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          text-decoration: none;
        }
        .pp-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .pp-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .pp-btn--primary { background: linear-gradient(135deg, #7b1c1c, #6a1818); color: white; }
        .pp-btn--primary:hover:not(:disabled) { background: linear-gradient(135deg, #6a1818, #5a1515); }
        .pp-btn--outline { background: white; border: 2px solid #7b1c1c; color: #7b1c1c; }
        .pp-btn--outline:hover:not(:disabled) { background: #7b1c1c; color: white; }
        .pp-btn--danger { background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626; }
        .pp-btn--danger:hover:not(:disabled) { background: #dc2626; color: white; }
        .pp-btn--sm { font-size: 12px; padding: 7px 12px; border-radius: 8px; }
        .pp-btn--lg { padding: 14px 24px; font-size: 15px; }

        /* ── Responsive ───────────────────────────────── */
        @media (max-width: 600px) {
          .pp-wrapper { padding: 12px 10px 50px; }
          .pp-hero__top { flex-direction: column; }
          .pp-hero__actions { width: 100%; }
          .pp-hero__actions .pp-btn { flex: 1; }
          .pp-tabs { gap: 0; }
          .pp-tab { padding: 12px 6px; font-size: 11px; }
          .pp-membership-hero__days { font-size: 2.2rem; }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;
