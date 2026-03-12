import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/header.css";
import {
  FaPhone,
  FaEnvelope,
  FaBell,
  FaShoppingCart,
  FaUser,
  FaChevronDown,
  FaBars,
  FaTimes,
  FaSignOutAlt,
  FaEllipsisV,
} from "react-icons/fa";

const Header = () => {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(2);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [dropdowns, setDropdowns] = useState({
    kategori: false,
    akun: false,
    bantuan: false,
    menu: false,
  });

  const dropdownRefs = useRef({
    kategori: null,
    akun: null,
    bantuan: null,
    menu: null,
  });

  // Function to get cart count from localStorage
  const getCartCount = () => {
    try {
      const cartData = JSON.parse(localStorage.getItem("cart") || "[]");
      const totalItems = cartData.reduce(
        (total, item) => total + (item.quantity || 1),
        0
      );
      return totalItems;
    } catch (error) {
      console.error("Error reading cart from localStorage:", error);
      return 0;
    }
  };

  // Function to check login status
  const checkAuthStatus = () => {
    try {
      const loginData = JSON.parse(
        sessionStorage.getItem("userLogin") || "null"
      );
      if (loginData && loginData.isLoggedIn && loginData.token) {
        setIsLoggedIn(true);
        setUserInfo(loginData.user || { username: "User" });
        return;
      }

      const registrationData = JSON.parse(
        sessionStorage.getItem("userRegistration") || "null"
      );
      if (registrationData && registrationData.isRegistered) {
        setIsLoggedIn(true);
        setUserInfo({
          username: registrationData.username || "User",
          ...registrationData.userData,
        });
        return;
      }

      const successfulRegData = JSON.parse(
        localStorage.getItem("successfulRegistration") || "null"
      );
      if (successfulRegData && successfulRegData.isSuccessfullyRegistered) {
        setIsLoggedIn(true);
        setUserInfo({
          username: successfulRegData.username || "User",
          email: successfulRegData.email,
          full_name: successfulRegData.full_name,
        });
        return;
      }

      setIsLoggedIn(false);
      setUserInfo(null);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsLoggedIn(false);
      setUserInfo(null);
    }
  };

  // Function to handle logout
  const handleLogout = () => {
    try {
      sessionStorage.removeItem("userLogin");
      sessionStorage.removeItem("userRegistration");
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("successfulRegistration");
      localStorage.removeItem("registerFormData");

      setIsLoggedIn(false);
      setUserInfo(null);
      setDropdowns({ kategori: false, akun: false, bantuan: false, menu: false });
      setIsMobileMenuOpen(false);

      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  // Update cart count
  useEffect(() => {
    const updateCartCount = () => setCartCount(getCartCount());
    updateCartCount();
    const handleStorageChange = (e) => {
      if (e.key === "cart") updateCartCount();
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("cartUpdated", updateCartCount);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cartUpdated", updateCartCount);
    };
  }, []);

  // Check auth status
  useEffect(() => {
    checkAuthStatus();
    const handleStorageChange = (e) => {
      if (
        ["userLogin", "userRegistration", "successfulRegistration"].includes(
          e.key
        )
      ) {
        checkAuthStatus();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const authCheckInterval = setInterval(checkAuthStatus, 1000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(authCheckInterval);
    };
  }, []);

  // Periodic cart count update
  useEffect(() => {
    const interval = setInterval(() => setCartCount(getCartCount()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDropdownToggle = (dropdownName) => {
    setDropdowns((prev) => {
      const newState = {
        kategori: dropdownName === "kategori" ? !prev.kategori : false,
        akun: dropdownName === "akun" ? !prev.akun : false,
        bantuan: dropdownName === "bantuan" ? !prev.bantuan : false,
        menu: dropdownName === "menu" ? !prev.menu : false,
      };

      setTimeout(() => {
        const dropdownElement = dropdownRefs.current[dropdownName];
        if (dropdownElement && newState[dropdownName]) {
          const dropdownMenu = dropdownElement.querySelector(".dropdown-menu");
          if (dropdownMenu) {
            const dropdownRect = dropdownElement.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            dropdownMenu.classList.remove("dropdown-menu-right");
            if (dropdownRect.left + 200 > viewportWidth - 20) {
              dropdownMenu.classList.add("dropdown-menu-right");
            }
          }
        }
      }, 10);

      return newState;
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideDropdown = Object.values(dropdownRefs.current).some(
        (ref) => ref && ref.contains(event.target)
      );
      if (!isClickInsideDropdown) {
        setDropdowns({ kategori: false, akun: false, bantuan: false, menu: false });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setIsMobileMenuOpen(false);
      setDropdowns({ kategori: false, akun: false, bantuan: false, menu: false });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleCartClick = () => navigate("/keranjang");
  const handleLogoClick = () => navigate("/");
  const handleLoginClick = () => navigate("/login");
  const handleRegisterClick = () => navigate("/register");
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    setDropdowns({ kategori: false, akun: false, bantuan: false, menu: false });
  };

  return (
    <header>
      {/* Navbar */}
      <nav className="navbar">
        {/* Logo */}
        <div
          className="logo"
          onClick={handleLogoClick}
          style={{ cursor: "pointer" }}
        >
          <span className="logo-bold">GSTREAM</span>
        </div>

        {/* Desktop: Auth buttons atau user dropdown */}
        <div className="nav-icons desktop-only">
          {!isLoggedIn ? (
            /* Belum login: tombol Masuk & Daftar */
            <div className="auth-buttons">
              <button
                className="auth-btn login-btn"
                onClick={handleLoginClick}
              >
                Masuk
              </button>
            </div>
          ) : (
            /* Sudah login: dropdown akun */
            <div
              className={`dropdown ${dropdowns.akun ? "show" : ""}`}
              ref={(el) => (dropdownRefs.current.akun = el)}
            >
              <button
                className="icon-btn user-btn logged-in"
                onClick={() => handleDropdownToggle("akun")}
              >
                <FaUser />
                <span className="username">
                  {userInfo?.username || userInfo?.full_name || "User"}
                </span>
                <FaChevronDown />
              </button>

              <div
                className={`dropdown-menu dropdown-menu-right ${
                  dropdowns.akun ? "show" : ""
                }`}
              >
                {/* Info user */}
                <div className="dropdown-user-info">
                  <strong>
                    {userInfo?.full_name || userInfo?.username || "User"}
                  </strong>
                  <small>{userInfo?.email || ""}</small>
                </div>

                <div className="dropdown-divider" />

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setDropdowns({ kategori: false, akun: false, bantuan: false, menu: false });
                    navigate("/profile");
                  }}
                >
                  <FaUser style={{ marginRight: 8 }} />
                  Profil Saya
                </button>

                <div className="dropdown-divider" />

                <button
                  className="dropdown-item logout-btn"
                  onClick={handleLogout}
                >
                  <FaSignOutAlt style={{ marginRight: 8 }} />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: hamburger button */}
        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
        {!isLoggedIn ? (
          /* Mobile: belum login */
          <div className="mobile-auth-buttons mobile-only">
            <button
              className="mobile-auth-btn login"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLoginClick();
              }}
            >
              Masuk
            </button>
            <button
              className="mobile-auth-btn register"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleRegisterClick();
              }}
            >
              Daftar
            </button>
          </div>
        ) : (
          /* Mobile: sudah login */
          <div className="mobile-user-section mobile-only">
            <div className="mobile-user-info">
              <FaUser className="user-icon" />
              <div className="user-details">
                <span className="username">
                  {userInfo?.username || userInfo?.full_name || "User"}
                </span>
                <span className="email">{userInfo?.email || ""}</span>
              </div>
            </div>
            <button className="mobile-logout-btn" onClick={handleLogout}>
              <FaSignOutAlt />
              Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

