import React, { useState, useRef } from "react";
import axios from "axios";
import { Mic, Square, Camera, Sparkles, CheckCircle2, UploadCloud, IndianRupee, Clock, FileText, LayoutDashboard } from "lucide-react";
import SellerDashboard from "./SellerDashboard";

export default function App() {
  const [view, setView] = useState("creator"); // "creator" or "dashboard"
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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

  // Step 1: Select image
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setStep(2);
    }
  };

  // Step 2: Audio handling
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

  // Unified submission: Voice + Manual Inputs
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

  // Step 3: Publish
  const handlePublish = async () => {
    setLoading(true);
    try {
      let uploadedUrl = "";
      if (imageFile) {
        const imgData = new FormData();
        imgData.append("image", imageFile);
        
        const imgRes = await axios.post("http://127.0.0.1:5000/api/products/upload-photo", imgData);
        uploadedUrl = imgRes.data.imageUrl;
      }

      await axios.post("http://127.0.0.1:5000/api/products/save", {
        titleEn: catalog.titleEn,
        titleHi: catalog.titleHi,
        category: catalog.category,
        material: catalog.material,
        descriptionEn: catalog.descriptionEn,
        descriptionHi: catalog.descriptionHi,
        imageUrl: uploadedUrl,
        pricing: catalog.pricing,
      });

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

  // Render Dashboard View
  if (view === "dashboard") {
    return <SellerDashboard onBackToCreator={() => setView("creator")} />;
  }

  // Render Creator / Listing Flow
  return (
    <div style={{ maxWidth: 480, margin: "20px auto", fontFamily: "sans-serif", padding: 16, background: "#fcfcfc", minHeight: "90vh", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #eee", paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "#d35400", margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 20 }}>
            <Sparkles color="#e67e22" /> Artisan Studio AI
          </h2>
          <button
            onClick={() => setView("dashboard")}
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
            <LayoutDashboard size={14} /> View Inventory
          </button>
        </div>
        <p style={{ color: "#777", fontSize: 13, margin: "6px 0 0 0" }}>Voice & Manual Business Cataloging</p>
      </div>

      {/* STEP 1: PHOTO */}
      {step === 1 && (
        <div style={{ textAlign: "center", padding: "40px 10px" }}>
          <div style={{ background: "#fff", border: "2px dashed #d35400", borderRadius: 16, padding: 30 }}>
            <Camera size={64} color="#d35400" />
            <h3 style={{ margin: "16px 0 8px 0" }}>Step 1: Product Photo</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>Choose or take a photo of your craft.</p>
            <label style={{ background: "#d35400", color: "#fff", padding: "12px 24px", borderRadius: 30, cursor: "pointer", fontWeight: 600, display: "inline-block" }}>
              Select Photo
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: VOICE + MANUAL INPUTS */}
      {step === 2 && (
        <div style={{ padding: "10px 0" }}>
          {imagePreview && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <img src={imagePreview} alt="Preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} />
            </div>
          )}

          {/* Voice Input Section */}
          <div style={{ textAlign: "center", marginBottom: 24, background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
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
              {recording ? "Recording... Click to Stop & Process" : "Tap to Speak Description"}
            </p>
          </div>

          {/* Manual Costing Inputs */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: 15, color: "#333" }}>Manual Costing & Details (Optional)</h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
                  <IndianRupee size={14} /> Material Cost (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={rawCost}
                  onChange={(e) => setRawCost(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={14} /> Labor Hours
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
                <FileText size={14} /> Craft Notes / Story
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Handcrafted terracotta bowl with floral patterns, kiln-fired twice..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <button
              onClick={() => submitDetails()}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px",
                background: "#d35400",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {loading ? "Processing AI Analysis..." : "Generate AI Catalog with Manual Details"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & PUBLISH */}
      {step === 3 && catalog && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
            {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />}
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{catalog.titleEn}</h3>
              <div style={{ color: "#777", fontSize: 14 }}>{catalog.titleHi}</div>
              <span style={{ fontSize: 12, background: "#f0f0f0", padding: "2px 8px", borderRadius: 4, marginTop: 4, display: "inline-block" }}>
                {catalog.category} • {catalog.material}
              </span>
            </div>
          </div>

          <p style={{ background: "#fff", border: "1px solid #eee", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.4, color: "#444" }}>
            {catalog.descriptionEn}
          </p>

          <h4 style={{ margin: "16px 0 8px 0" }}>Suggested Pricing (Based on Inputs)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div style={{ background: "#fff9db", padding: 10, borderRadius: 8, border: "1px solid #ffe066" }}>
              <div style={{ fontSize: 11, color: "#f08c00" }}>Floor</div>
              <strong>₹{catalog.pricing?.floorPrice}</strong>
            </div>
            <div style={{ background: "#ebfbee", padding: 10, borderRadius: 8, border: "1px solid #b2f2bb" }}>
              <div style={{ fontSize: 11, color: "#2b8a3e" }}>Fair</div>
              <strong style={{ color: "#2b8a3e", fontSize: 18 }}>₹{catalog.pricing?.recommendedPrice}</strong>
            </div>
            <div style={{ background: "#e7f5ff", padding: 10, borderRadius: 8, border: "1px solid #a5d8ff" }}>
              <div style={{ fontSize: 11, color: "#1971c2" }}>Exhibition</div>
              <strong>₹{catalog.pricing?.exhibitionPrice}</strong>
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 24,
              padding: "14px",
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
            {loading ? "Publishing..." : <><UploadCloud size={20} /> 1-Click Publish Product</>}
          </button>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "40px 10px" }}>
          <CheckCircle2 size={72} color="#27ae60" style={{ margin: "0 auto 16px" }} />
          <h2>Product Live in Catalog!</h2>
          <p style={{ color: "#666" }}>Your product has been saved to the database.</p>
          
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <button
              onClick={resetForm}
              style={{
                padding: "12px 20px",
                background: "#27ae60",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Another Product
            </button>

            <button
              onClick={() => {
                resetForm();
                setView("dashboard");
              }}
              style={{
                padding: "12px 20px",
                background: "#2c3e50",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View My Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}