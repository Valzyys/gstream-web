import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "https://v2.jkt48connect.com/api/jkt48connect";
const API_KEY = "JKTCONNECT";

function Login() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ login: "", password: "" });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const loginData = JSON.parse(sessionStorage.getItem("userLogin") || "null");
      if (loginData && loginData.isLoggedIn && loginData.token) {
        navigate("/");
        return;
      }
      const registrationData = JSON.parse(sessionStorage.getItem("userRegistration") || "null");
      if (registrationData && registrationData.isRegistered) {
        sessionStorage.removeItem("userRegistration");
        navigate("/");
      }
    } catch (error) {
      console.error("Error checking login status:", error);
    }
  }, [navigate]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.login.trim()) {
      showToast("Username atau email harus diisi", "error");
      return false;
    }
    if (!formData.password) {
      showToast("Password harus diisi", "error");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login?apikey=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          login: formData.login.toLowerCase().trim(),
          password: formData.password,
        }),
      });
      const data = await response.json();

      if (data.status === true) {
        const loginData = {
          isLoggedIn: true,
          token: data.data.session?.access_token,
          sessionId: data.data.session?.id,
          expiresAt: data.data.session?.expires_at,
          user: data.data.user,
          loginAt: new Date().toISOString(),
        };
        sessionStorage.setItem("userLogin", JSON.stringify(loginData));
        sessionStorage.setItem("authToken", data.data.session?.access_token);
        showToast("Login berhasil! Mengalihkan ke halaman utama...", "success");
        setTimeout(() => navigate("/"), 1500);
      } else {
        const attemptsMsg =
          data.attempts_remaining !== undefined
            ? ` (${data.attempts_remaining} percobaan tersisa)`
            : "";
        showToast((data.message || "Login gagal. Silakan coba lagi.") + attemptsMsg, "error");
      }
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        showToast("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.", "error");
      } else {
        showToast("Terjadi kesalahan: " + error.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setFormData({ login: "", password: "" });

  return (
    <div className="lp-wrapper">
      {/* Toast */}
      {toast.show && (
        <div className={`lp-toast lp-toast--${toast.type}`}>
          <div className="lp-toast__content">
            <span className="lp-toast__icon">{toast.type === "success" ? "✅" : "❌"}</span>
            <span className="lp-toast__message">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="lp-card">
        {/* Header */}
        <div className="lp-card__header">
          <div className="lp-card__header-icon">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h1 className="lp-card__title">Masuk Akun</h1>
          <p className="lp-card__subtitle">Silakan masuk dengan username atau email untuk melanjutkan</p>
        </div>

        {/* Body */}
        <div className="lp-card__body">
          {/* Form */}
          <form onSubmit={handleLogin} className="lp-form" noValidate>

            {/* Username / Email */}
            <div className={`lp-form__group ${focusedField === "login" ? "lp-form__group--focused" : ""}`}>
              <label className="lp-form__label" htmlFor="login">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Username atau Email
              </label>
              <input
                type="text"
                id="login"
                name="login"
                value={formData.login}
                onChange={handleInputChange}
                onFocus={() => setFocusedField("login")}
                onBlur={() => setFocusedField(null)}
                placeholder="username / email@kamu.com"
                className="lp-form__input"
                disabled={loading}
                autoComplete="username"
              />
              <small className="lp-form__hint">Masukkan username atau email yang terdaftar</small>
            </div>

            {/* Password */}
            <div className={`lp-form__group ${focusedField === "password" ? "lp-form__group--focused" : ""}`}>
              <label className="lp-form__label" htmlFor="password">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Password
              </label>
              <div className="lp-form__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Masukkan password"
                  className="lp-form__input lp-form__input--with-toggle"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lp-form__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <small className="lp-form__hint">Password akun Anda</small>
            </div>

            {/* Actions */}
            <div className="lp-form__actions">
              <button type="submit" className="lp-btn lp-btn--primary lp-btn--full" disabled={loading}>
                <span>{loading ? "Memproses..." : "Masuk Sekarang"}</span>
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
              <button type="button" className="lp-btn lp-btn--outline lp-btn--full" onClick={handleReset} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                <span>Reset Form</span>
              </button>
            </div>

            <div className="lp-divider"><span>atau</span></div>

            <div className="lp-form__links">
              <Link to="/register" className="lp-link-card">
                <div className="lp-link-card__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                </div>
                <div className="lp-link-card__text">
                  <strong>Belum punya akun?</strong>
                  <span>Daftar sekarang</span>
                </div>
                <div className="lp-link-card__arrow">→</div>
              </Link>
            </div>
          </form>

          {/* Info */}
          <div className="lp-info">
            <div className="lp-info__card">
              <div className="lp-info__header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <h3>Informasi Login</h3>
              </div>
              <ul className="lp-info__list">
                <li>Login menggunakan username atau email terdaftar</li>
                <li>Session berlaku selama 24 jam</li>
                <li>Jaga kerahasiaan password Anda</li>
                <li>Akses cepat ke semua livestream</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .lp-wrapper {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
          padding: 20px;
          box-sizing: border-box;
        }

        .lp-card {
          width: 100%;
          max-width: 1000px;
        }

        /* Card */
        .lp-card {
          width: 100%;
          max-width: 1000px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
          overflow: hidden;
          animation: lpFadeUp 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes lpFadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .lp-card__header {
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          color: white;
          text-align: center;
          padding: 50px 30px;
          position: relative;
          overflow: hidden;
        }
        .lp-card__header::before {
          content: "";
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: lpPulse 4s ease-in-out infinite;
        }
        @keyframes lpPulse {
          0%,100% { transform: scale(1); opacity: 0.5; }
          50%      { transform: scale(1.1); opacity: 0.3; }
        }
        .lp-card__header-icon {
          position: relative;
          z-index: 1;
          margin-bottom: 20px;
        }
        .lp-card__title {
          position: relative;
          z-index: 1;
          margin: 0 0 12px;
          font-size: 2.2rem;
          font-weight: 700;
        }
        .lp-card__subtitle {
          position: relative;
          z-index: 1;
          margin: 0;
          font-size: 1.05rem;
          opacity: 0.95;
        }

        /* Body */
        .lp-card__body {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 40px;
          padding: 40px;
          box-sizing: border-box;
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .lp-form__group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.3s ease;
        }
        .lp-form__group--focused {
          transform: translateX(4px);
        }
        .lp-form__label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          transition: color 0.3s ease;
        }
        .lp-form__group--focused .lp-form__label {
          color: #7b1c1c;
        }
        .lp-form__input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .lp-form__input {
          width: 100%;
          padding: 14px 18px;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          background: #f8f9fa;
          color: #333;
          box-sizing: border-box;
          transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
          outline: none;
        }
        .lp-form__input--with-toggle {
          padding-right: 48px;
        }
        .lp-form__input:focus {
          border-color: #7b1c1c;
          background: white;
          box-shadow: 0 4px 14px rgba(123,28,28,0.12);
        }
        .lp-form__input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .lp-form__toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }
        .lp-form__toggle:hover { color: #7b1c1c; }
        .lp-form__hint {
          font-size: 12px;
          color: #888;
          font-style: italic;
          transition: color 0.3s ease;
        }
        .lp-form__group--focused .lp-form__hint { color: #7b1c1c; }

        /* Actions */
        .lp-form__actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Buttons */
        .lp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          cursor: pointer;
          border: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .lp-btn--full { width: 100%; }
        .lp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lp-btn:not(:disabled):hover { transform: translateY(-2px); }
        .lp-btn--primary {
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          color: white;
        }
        .lp-btn--primary:not(:disabled):hover {
          box-shadow: 0 6px 18px rgba(123,28,28,0.35);
        }
        .lp-btn--outline {
          background: white;
          border: 2px solid #7b1c1c;
          color: #7b1c1c;
        }
        .lp-btn--outline:not(:disabled):hover {
          background: #7b1c1c;
          color: white;
        }

        /* Divider */
        .lp-divider {
          position: relative;
          text-align: center;
        }
        .lp-divider::before {
          content: "";
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 1px;
          background: #e1e5e9;
        }
        .lp-divider span {
          position: relative;
          background: white;
          padding: 0 16px;
          color: #999;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* Link card */
        .lp-form__links { margin-top: 4px; }
        .lp-link-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
          text-decoration: none;
          color: #333;
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }
        .lp-link-card:hover {
          border-color: #7b1c1c;
          background: white;
          box-shadow: 0 6px 18px rgba(123,28,28,0.12);
          transform: translateY(-2px);
        }
        .lp-link-card__icon {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          transition: transform 0.4s ease;
        }
        .lp-link-card:hover .lp-link-card__icon { transform: rotate(360deg) scale(1.1); }
        .lp-link-card__text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .lp-link-card__text strong { font-size: 14px; color: #333; }
        .lp-link-card__text span { font-size: 12px; color: #666; }
        .lp-link-card__arrow { font-size: 22px; color: #7b1c1c; transition: transform 0.3s ease; }
        .lp-link-card:hover .lp-link-card__arrow { transform: translateX(6px); }

        /* Info panel */
        .lp-info { display: flex; flex-direction: column; }
        .lp-info__card {
          background: #f8f9fa;
          border-radius: 16px;
          padding: 24px;
          border: 2px solid #e1e5e9;
          transition: all 0.3s ease;
          height: fit-content;
        }
        .lp-info__card:hover {
          border-color: #7b1c1c;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          transform: translateY(-3px);
        }
        .lp-info__header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 2px solid #dee2e6;
          color: #7b1c1c;
        }
        .lp-info__header h3 { margin: 0; color: #333; font-size: 1.1rem; font-weight: 700; }
        .lp-info__list {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
        }
        .lp-info__list li {
          padding: 12px 0;
          color: #555;
          font-size: 13px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s ease;
        }
        .lp-info__list li::before {
          content: "✓";
          color: #7b1c1c;
          font-weight: 700;
          flex-shrink: 0;
        }
        .lp-info__list li:last-child { border-bottom: none; }
        .lp-info__list li:hover { padding-left: 6px; color: #7b1c1c; }

        /* Toast */
        .lp-toast {
          position: fixed;
          top: 24px; right: 24px;
          z-index: 9999;
          max-width: 420px;
          border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18);
          animation: lpSlideIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55);
        }
        @keyframes lpSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .lp-toast--success {
          background: linear-gradient(135deg, #d4edda, #c3e6cb);
          border: 2px solid #b1dfbb;
          color: #155724;
        }
        .lp-toast--error {
          background: linear-gradient(135deg, #f8d7da, #f5c6cb);
          border: 2px solid #f1b0b7;
          color: #721c24;
        }
        .lp-toast__content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
        }
        .lp-toast__icon { font-size: 22px; }
        .lp-toast__message { font-weight: 600; font-size: 14px; line-height: 1.5; }

        /* Responsive */
        @media (max-width: 768px) {
          .lp-wrapper { padding: 15px; }
          .lp-card__header { padding: 40px 20px; }
          .lp-card__title { font-size: 1.8rem; }
          .lp-card__body {
            grid-template-columns: 1fr;
            gap: 24px;
            padding: 24px 20px;
          }
          .lp-info { order: -1; }
          .lp-toast { left: 15px; right: 15px; max-width: none; }
        }
        @media (max-width: 480px) {
          .lp-card__header { padding: 32px 15px; }
          .lp-card__title { font-size: 1.6rem; }
          .lp-card__body { padding: 18px 14px; }
          .lp-form__input { font-size: 16px; }
          .lp-btn { font-size: 14px; padding: 13px 18px; }
        }
      `}</style>
    </div>
  );
}

export default Login;
