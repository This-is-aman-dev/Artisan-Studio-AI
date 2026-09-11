import React, { useState } from "react";
import axios from "axios";
import { User, Phone, Lock, Sparkles, X, KeyRound, CheckCircle2, ShoppingBag, Palette } from "lucide-react";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  // Modes: "login" | "register" | "forgot_request" | "forgot_verify"
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("artisan"); // "artisan" | "buyer"

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [craftSpecialty, setCraftSpecialty] = useState("Traditional Crafts");

  // Forgot password states
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [demoHint, setDemoHint] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const resetState = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setDemoHint("");
  };

  const handleLoginOrRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    const isRegister = mode === "register";
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegister
      ? { name, phone, password, craftSpecialty: role === "artisan" ? craftSpecialty : "N/A", role }
      : { phone, password };

    try {
      const res = await axios.post(`http://127.0.0.1:5000${endpoint}`, payload);
      const { token, user } = res.data;

      localStorage.setItem("artisan_token", token);
      localStorage.setItem("artisan_user", JSON.stringify(user));

      onAuthSuccess(user, token);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    try {
      const res = await axios.post("http://127.0.0.1:5000/api/auth/forgot-password", { phone });
      setSuccessMsg(res.data.message);
      if (res.data.demoOtp) {
        setDemoHint(`Demo OTP: ${res.data.demoOtp}`);
      }
      setMode("forgot_verify");
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetState();

    try {
      const res = await axios.post("http://127.0.0.1:5000/api/auth/reset-password", {
        phone,
        otp,
        newPassword,
      });
      setSuccessMsg(res.data.message);
      setTimeout(() => {
        setMode("login");
        resetState();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const activeColor = role === "buyer" ? "#0f766e" : "#d35400";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 420,
          width: "100%",
          padding: 24,
          position: "relative",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: role === "buyer" ? "#f0fdfa" : "#fff7ed",
              color: activeColor,
              padding: 10,
              borderRadius: "50%",
              marginBottom: 8,
            }}
          >
            {mode.startsWith("forgot") ? (
              <KeyRound size={24} />
            ) : role === "buyer" ? (
              <ShoppingBag size={24} />
            ) : (
              <Sparkles size={24} />
            )}
          </div>
          <h2 style={{ margin: 0, color: "#1e293b", fontSize: 20 }}>
            {mode === "login" && "Sign In"}
            {mode === "register" && `Register as ${role === "buyer" ? "Buyer" : "Artisan"}`}
            {mode === "forgot_request" && "Reset Password via OTP"}
            {mode === "forgot_verify" && "Verify OTP & New Password"}
          </h2>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: 13 }}>
            {mode.startsWith("forgot")
              ? "Verify your mobile number to regain access"
              : role === "buyer"
              ? "Explore verified crafts & direct trade negotiations"
              : "Access your private inventory & voice cataloging"}
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: "#dcfce7", color: "#166534", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {demoHint && (
          <div style={{ background: "#fef3c7", color: "#92400e", padding: "6px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14, fontWeight: 600 }}>
            ⚡ {demoHint}
          </div>
        )}

        {/* 1. LOGIN & REGISTER FORM */}
        {(mode === "login" || mode === "register") && (
          <form onSubmit={handleLoginOrRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Role Selection Toggle for Registration */}
            {mode === "register" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => setRole("artisan")}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: role === "artisan" ? "2px solid #d35400" : "1px solid #cbd5e1",
                    background: role === "artisan" ? "#fff7ed" : "#fff",
                    color: role === "artisan" ? "#d35400" : "#64748b",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <Palette size={14} /> Artisan / Seller
                </button>
                <button
                  type="button"
                  onClick={() => setRole("buyer")}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: role === "buyer" ? "2px solid #0f766e" : "1px solid #cbd5e1",
                    background: role === "buyer" ? "#f0fdfa" : "#fff",
                    color: role === "buyer" ? "#0f766e" : "#64748b",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <ShoppingBag size={14} /> Craft Buyer
                </button>
              </div>
            )}

            {mode === "register" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={14} /> Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder={role === "artisan" ? "e.g. Ramesh Kumar" : "e.g. Priya Sharma"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={14} /> Mobile Phone Number
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <Lock size={14} /> Password / 4-Digit PIN
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      resetState();
                      setMode("forgot_request");
                    }}
                    style={{ background: "none", border: "none", color: activeColor, fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
              />
            </div>

            {mode === "register" && role === "artisan" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  Craft Specialty
                </label>
                <input
                  type="text"
                  placeholder="e.g. Terracotta Pottery, Handloom"
                  value={craftSpecialty}
                  onChange={(e) => setCraftSpecialty(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "12px",
                background: activeColor,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading
                ? "Please wait..."
                : mode === "register"
                ? `Register as ${role === "buyer" ? "Buyer" : "Artisan"}`
                : "Sign In"}
            </button>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  resetState();
                  setMode(mode === "login" ? "register" : "login");
                }}
                style={{ background: "none", border: "none", color: activeColor, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                {mode === "login" ? "Need an account? Sign up here" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        )}

        {/* 2. FORGOT PASSWORD: STEP 1 (ENTER PHONE) */}
        {mode === "forgot_request" && (
          <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={14} /> Registered Mobile Number
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px",
                background: "#d35400",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Sending OTP..." : "Send Verification OTP"}
            </button>

            <button
              type="button"
              onClick={() => {
                resetState();
                setMode("login");
              }}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13 }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD: STEP 2 (VERIFY OTP & NEW PASSWORD) */}
        {mode === "forgot_verify" && (
          <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={14} /> 4-Digit OTP
              </label>
              <input
                type="text"
                required
                maxLength={4}
                placeholder="e.g. 1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: "bold" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={14} /> Set New Password / PIN
              </label>
              <input
                type="password"
                required
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Updating..." : "Save New Password"}
            </button>

            <button
              type="button"
              onClick={() => {
                resetState();
                setMode("forgot_request");
              }}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13 }}
            >
              Resend OTP / Change Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}