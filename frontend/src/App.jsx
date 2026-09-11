import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Mic,
  Square,
  Camera,
  Sparkles,
  CheckCircle2,
  UploadCloud,
  IndianRupee,
  Clock,
  FileText,
  LayoutDashboard,
  User as UserIcon,
  LogOut,
  ShoppingBag,
  Palette,
} from "lucide-react";
import SellerDashboard from "./SellerDashboard";
import BuyerPortal from "./BuyerPortal";
import AuthModal from "./AuthModal";

export default function App() {
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem("artisan_token") || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("artisan_user") || "null");
    } catch {
      return null;
    }
  });

  // Default view: Buyer for buyers, Creator for artisans
  const [view, setView] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("artisan_user") || "null");
      return savedUser?.role === "buyer" ? "buyer" : "creator";
    } catch {
      return "creator";
    }
  });

  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Costing & notes state
  const [rawCost, setRawCost] = useState("");
  const [hours, setHours] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Dynamic routing on login/register
  const handleAuthSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    if (userData.role === "buyer") {
      setView("buyer");
    } else {
      setView("creator");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("artisan_token");
    localStorage.removeItem("artisan_user");
    setToken(null);
    setUser(null);
    setView("creator");
    resetForm();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setStep(2);
    }
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        submitDetails(mimeType);
      };

      recorder.start(250);
      setRecording(true);
    } catch (err) {
      alert("Could not access microphone: " + err.message);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const submitDetails = async (mimeType = "audio/webm") => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        formData.append("audio", audioBlob, `voice.${extension}`);
      }

      formData.append("manualRawCost", rawCost);
      formData.append("manualHours", hours);
      formData.append("manualNotes", manualNotes);

      const response = await axios.post("http://127.0.0.1:5000/api/products/process-voice", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCatalog(response.data);
      setStep(3);
    } catch (err) {
      alert("Processing error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!token) {
      setIsAuthOpen(true);
      return;
    }

    setLoading(true);
    try {
      let uploadedUrl = "";
      if (imageFile) {
        const imgData = new FormData();
        imgData.append("image", imageFile);
        const imgRes = await axios.post("http://127.0.0.1:5000/api/products/upload-photo", imgData);
        uploadedUrl = imgRes.data.imageUrl;
      }

      await axios.post(
        "http://127.0.0.1:5000/api/products/save",
        {
          titleEn: catalog.titleEn,
          titleHi: catalog.titleHi,
          category: catalog.category,
          material: catalog.material,
          descriptionEn: catalog.descriptionEn,
          descriptionHi: catalog.descriptionHi,
          imageUrl: uploadedUrl,
          pricing: catalog.pricing,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStep(4);
    } catch (err) {
      alert("Save failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setImageFile(null);
    setImagePreview(null);
    setCatalog(null);
    setRawCost("");
    setHours("");
    setManualNotes("");
    setRecording(false);
    setLoading(false);
  };

  // ==========================================
  // 1. STRICT ROUTING: LOGGED-IN BUYER
  // ==========================================
  if (user && user.role === "buyer") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <BuyerPortal
          user={user}
          token={token}
          onLogout={handleLogout}
          onRequestLogin={() => setIsAuthOpen(true)}
        />
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // ==========================================
  // 2. UNREGISTERED USER BROWSING BUYER VIEW
  // ==========================================
  if (!user && view === "buyer") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ background: "#0f172a", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>Public Buyer Preview</span>
          <button
            onClick={() => setView("creator")}
            style={{ background: "#d35400", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            Go to Artisan Studio
          </button>
        </div>
        <BuyerPortal
          user={null}
          token={null}
          onLogout={handleLogout}
          onRequestLogin={() => setIsAuthOpen(true)}
        />
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // ==========================================
  // 3. ARTISAN STUDIO FLOW (CREATOR & DASHBOARD)
  // ==========================================
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      {/* Top Bar for Artisans */}
      <div
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "10px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color="#f59e0b" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Artisan Studio AI</span>
          <span style={{ background: "#d35400", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
            Artisan Portal
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!user && (
            <button
              onClick={() => setView("buyer")}
              style={{
                background: "#0f766e",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Explore Buyer Marketplace
            </button>
          )}

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#fb923c", fontWeight: 600 }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {view === "dashboard" ? (
        <SellerDashboard
          onBackToCreator={() => setView("creator")}
          user={user}
          token={token}
          onLogout={handleLogout}
          onRequestLogin={() => setIsAuthOpen(true)}
        />
      ) : (
        <div
          style={{
            maxWidth: 480,
            margin: "30px auto",
            padding: 16,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ borderBottom: "1px solid #eee", paddingBottom: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#d35400", margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 20 }}>
                <Sparkles color="#e67e22" /> Artisan Studio
              </h2>
              <button
                onClick={() => {
                  if (!token) setIsAuthOpen(true);
                  else setView("dashboard");
                }}
                style={{
                  background: "#2c3e50",
                  color: "#fff",
                  border: "none",
                  padding: "7px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <LayoutDashboard size={14} /> My Stock
              </button>
            </div>
            <p style={{ color: "#777", fontSize: 13, margin: "6px 0 0 0" }}>Voice & AI Cataloging Wizard</p>
          </div>

          {step === 1 && (
            <div style={{ textAlign: "center", padding: "40px 10px" }}>
              <div style={{ background: "#fff", border: "2px dashed #d35400", borderRadius: 16, padding: 30 }}>
                <Camera size={64} color="#d35400" />
                <h3 style={{ margin: "16px 0 8px 0" }}>Step 1: Product Photo</h3>
                <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>Choose or take a photo of your craft.</p>
                <label
                  style={{
                    background: "#d35400",
                    color: "#fff",
                    padding: "12px 24px",
                    borderRadius: 30,
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "inline-block",
                  }}
                >
                  Select Photo
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ padding: "10px 0" }}>
              {imagePreview && (
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} />
                </div>
              )}

              <div style={{ textAlign: "center", marginBottom: 24, background: "#fafafa", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loading}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    border: recording ? "4px solid #fca5a5" : "none",
                    backgroundColor: recording ? "#dc2626" : "#16a34a",
                    color: "#fff",
                    cursor: loading ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {recording ? <Square size={32} /> : <Mic size={32} />}
                </button>
                <p style={{ fontWeight: 600, marginTop: 10, fontSize: 14, color: recording ? "#dc2626" : "#16a34a" }}>
                  {recording ? "Recording... Click to Stop" : "Tap to Speak Description"}
                </p>
              </div>

              <div style={{ background: "#fafafa", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 15, color: "#333" }}>Manual Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Material Cost (₹)</label>
                    <input
                      type="number"
                      placeholder="150"
                      value={rawCost}
                      onChange={(e) => setRawCost(e.target.value)}
                      style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Labor Hours</label>
                    <input
                      type="number"
                      placeholder="4"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Craft Story / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Handcrafted item details..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  onClick={() => submitDetails()}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "#d35400",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Generating..." : "Generate Listing"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && catalog && (
            <div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />}
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{catalog.titleEn}</h3>
                  <div style={{ color: "#777", fontSize: 14 }}>{catalog.titleHi}</div>
                </div>
              </div>

              <p style={{ background: "#f8fafc", border: "1px solid #eee", padding: 12, borderRadius: 8, fontSize: 13 }}>
                {catalog.descriptionEn}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", margin: "16px 0" }}>
                <div style={{ background: "#fff9db", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#f08c00" }}>Floor</div>
                  <strong>₹{catalog.pricing?.floorPrice}</strong>
                </div>
                <div style={{ background: "#ebfbee", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#2b8a3e" }}>Fair</div>
                  <strong style={{ color: "#2b8a3e" }}>₹{catalog.pricing?.recommendedPrice}</strong>
                </div>
                <div style={{ background: "#e7f5ff", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#1971c2" }}>Exhibition</div>
                  <strong>₹{catalog.pricing?.exhibitionPrice}</strong>
                </div>
              </div>

              <button
                onClick={handlePublish}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 14,
                  background: "#d35400",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? "Publishing..." : <><UploadCloud size={20} /> Publish to Live Marketplace</>}
              </button>
            </div>
          )}

          {step === 4 && (
            <div style={{ textAlign: "center", padding: "40px 10px" }}>
              <CheckCircle2 size={72} color="#27ae60" style={{ margin: "0 auto 16px" }} />
              <h2>Product Live in Marketplace!</h2>
              <p style={{ color: "#666" }}>Buyers can now discover and purchase this item.</p>
              <button
                onClick={resetForm}
                style={{ marginTop: 16, padding: "12px 24px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
              >
                + Add Another Product
              </button>
            </div>
          )}
        </div>
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}