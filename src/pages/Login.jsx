import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "https://v2.jkt48connect.com/api/jkt48connect";
const API_KEY = "JKTCONNECT";

function Login() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginAndRegistration = () => {
      try {
        const loginData = JSON.parse(
          sessionStorage.getItem("userLogin") || "null"
        );
        if (loginData && loginData.isLoggedIn && loginData.token) {
          navigate("/");
          return;
        }

        const registrationData = JSON.parse(
          sessionStorage.getItem("userRegistration") || "null"
        );
        if (registrationData && registrationData.isRegistered) {
          sessionStorage.removeItem("userRegistration");
          navigate("/");
          return;
        }
      } catch (error) {
        console.error("Error checking login/registration status:", error);
      }
    };

    checkLoginAndRegistration();
  }, [navigate]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
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
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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

        setTimeout(() => {
          navigate("/");
        }, 1500);
      } else {
        const attemptsMsg =
          data.attempts_remaining !== undefined
            ? ` (${data.attempts_remaining} percobaan tersisa)`
            : "";
        showToast((data.message || "Login gagal. Silakan coba lagi.") + attemptsMsg, "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        showToast("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.", "error");
      } else {
        showToast("Terjadi kesalahan: " + error.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ login: "", password: "" });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="login-loading">
          <div className="loading-spinner"></div>
          <p>Memproses login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {toast.type === "success" ? "✅" : "❌"}
            </div>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="login-container">
        <div className="login-header">
          <div className="header-icon">
            <svg
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h1>Masuk Akun</h1>
          <p>Silakan masuk dengan username atau email untuk melanjutkan</p>
        </div>

        <div className="login-form-container">
          <form onSubmit={handleLogin} className="login-form" noValidate>

            {/* Username / Email */}
            <div className={`form-group ${focusedField === "login" ? "focused" : ""}`}>
              <label htmlFor="login">
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
                className="form-input"
                disabled={loading}
                autoComplete="username"
              />
              <small className="form-hint">Masukkan username atau email yang terdaftar</small>
            </div>

            {/* Password */}
            <div className={`form-group ${focusedField === "password" ? "focused" : ""}`}>
              <label htmlFor="password">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Password
              </label>
              <div className="input-with-toggle">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Masukkan password"
                  className="form-input"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
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
              <small className="form-hint">Password akun Anda</small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                <span>{loading ? "Memproses..." : "Masuk Sekarang"}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-full"
                onClick={handleReset}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                <span>Reset Form</span>
              </button>
            </div>

            <div className="form-divider">
              <span>atau</span>
            </div>

            <div className="form-links">
              <Link to="/register" className="link-card">
                <div className="link-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                </div>
                <div className="link-text">
                  <strong>Belum punya akun?</strong>
                  <span>Daftar sekarang</span>
                </div>
                <div className="link-arrow">→</div>
              </Link>
            </div>
          </form>

          <div className="login-inf">
            <div className="info-cardo">
              <div className="info-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <h3>Informasi Login</h3>
              </div>
              <ul className="info-list">
                <li>
                  <span className="info-icon"></span>
                  <span>Login menggunakan username atau email terdaftar</span>
                </li>
                <li>
                  <span className="info-icon"></span>
                  <span>Session berlaku selama 24 jam</span>
                </li>
                <li>
                  <span className="info-icon"></span>
                  <span>Jaga kerahasiaan password Anda</span>
                </li>
                <li>
                  <span className="info-icon"></span>
                  <span>Akses cepat ke semua livestream</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8eef3 100%);
        }

        .login-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(123, 28, 28, 0.1);
          border-top: 4px solid #7b1c1c;
          border-radius: 50%;
          animation: spin 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .login-container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          color: white;
          text-align: center;
          padding: 50px 30px;
          position: relative;
          overflow: hidden;
        }

        .login-header::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 4s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }

        .header-icon {
          margin-bottom: 20px;
          animation: fadeIn 0.8s ease-out 0.2s both;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }

        .login-header h1 {
          margin-bottom: 12px;
          font-size: 2.2rem;
          font-weight: 700;
          position: relative;
          z-index: 1;
          animation: fadeIn 0.8s ease-out 0.3s both;
        }

        .login-header p {
          font-size: 1.05rem;
          opacity: 0.95;
          position: relative;
          z-index: 1;
          animation: fadeIn 0.8s ease-out 0.4s both;
        }

        .login-form-container {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 40px;
          padding: 40px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .form-group.focused {
          transform: translateX(4px);
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color 0.3s ease;
        }

        .form-group.focused label {
          color: #7b1c1c;
        }

        .form-group label svg {
          transition: transform 0.3s ease;
        }

        .form-group.focused label svg {
          transform: scale(1.1);
        }

        /* Input with toggle button wrapper */
        .input-with-toggle {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-toggle .form-input {
          width: 100%;
          padding-right: 48px;
        }

        .toggle-password-btn {
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

        .toggle-password-btn:hover {
          color: #7b1c1c;
        }

        .form-input {
          padding: 16px 18px;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          background: #f8f9fa;
        }

        .form-input:focus {
          outline: none;
          border-color: #7b1c1c;
          background: white;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(123, 28, 28, 0.15);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-hint {
          color: #666;
          font-size: 13px;
          font-style: italic;
          transition: color 0.3s ease;
          margin-left: 2px;
        }

        .form-group.focused .form-hint {
          color: #7b1c1c;
        }

        .form-actions {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 10px;
        }

        .form-divider {
          position: relative;
          text-align: center;
          margin: 10px 0;
        }

        .form-divider::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: #e1e5e9;
        }

        .form-divider span {
          position: relative;
          background: white;
          padding: 0 20px;
          color: #999;
          font-size: 13px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .form-links {
          margin-top: 5px;
        }

        .link-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          text-decoration: none;
          color: #333;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
        }

        .link-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(123, 28, 28, 0.15);
          background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
          border-color: #7b1c1c;
        }

        .link-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .link-card:hover .link-icon {
          transform: rotate(360deg) scale(1.1);
        }

        .link-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .link-text strong { font-size: 15px; color: #333; }
        .link-text span { font-size: 13px; color: #666; }

        .link-arrow {
          font-size: 24px;
          color: #7b1c1c;
          transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .link-card:hover .link-arrow {
          transform: translateX(6px);
        }

        .btn {
          padding: 16px 24px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          position: relative;
          overflow: hidden;
        }

        .btn::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s ease, height 0.6s ease;
        }

        .btn:hover::before { width: 300px; height: 300px; }
        .btn span, .btn svg { position: relative; z-index: 1; }

        .btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        .btn:active:not(:disabled) { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-primary {
          background: linear-gradient(135deg, #7b1c1c 0%, #6a1818 100%);
          color: white;
          border: 2px solid transparent;
        }

        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #6a1818 0%, #5a1515 100%);
          box-shadow: 0 8px 20px rgba(123, 28, 28, 0.4);
        }

        .btn-outline {
          background: white;
          border: 2px solid #7b1c1c;
          color: #7b1c1c;
        }

        .btn-outline:hover:not(:disabled) {
          background: #7b1c1c;
          color: white;
        }

        .btn-full { width: 100%; }

        .login-info {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .info-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 16px;
          padding: 28px;
          border: 2px solid #e1e5e9;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .info-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          border-color: #7b1c1c;
        }

        .info-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #dee2e6;
        }

        .info-header svg { color: #7b1c1c; }

        .info-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.15rem;
          font-weight: 700;
        }

        .info-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .info-list li {
          padding: 14px 0;
          color: #555;
          font-size: 14px;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .info-list li:hover { padding-left: 8px; color: #7b1c1c; }
        .info-icon { font-size: 18px; flex-shrink: 0; transition: transform 0.3s ease; }
        .info-list li:hover .info-icon { transform: scale(1.2); }
        .info-list li:last-child { border-bottom: none; }

        .toast {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 1000;
          max-width: 420px;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          animation: slideInRight 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          backdrop-filter: blur(10px);
        }

        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .toast-success {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border: 2px solid #b1dfbb;
          color: #155724;
        }

        .toast-error {
          background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
          border: 2px solid #f1b0b7;
          color: #721c24;
        }

        .toast-content {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          gap: 14px;
        }

        .toast-icon {
          font-size: 24px;
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .toast-message { font-weight: 600; font-size: 14px; line-height: 1.5; }

        @media (max-width: 768px) {
          .container { padding: 15px; }
          .login-header { padding: 40px 20px; }
          .login-header h1 { font-size: 1.8rem; }
          .login-form-container {
            grid-template-columns: 1fr;
            gap: 30px;
            padding: 30px 20px;
          }
          .login-info { order: -1; }
          .toast { left: 15px; right: 15px; max-width: none; }
        }

        @media (max-width: 480px) {
          .login-header { padding: 35px 15px; }
          .login-header h1 { font-size: 1.6rem; }
          .login-form-container { padding: 20px 15px; }
          .form-input { font-size: 16px; padding: 14px 16px; }
          .btn { padding: 16px 20px; font-size: 15px; }
          .info-card { padding: 20px; }
        }
      `}</style>
    </div>
  );
}

export default Login;
