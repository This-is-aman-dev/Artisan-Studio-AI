import React, { useState, useEffect } from "react";
import axios from "axios";
import { Package, IndianRupee, CheckCircle, Trash2, ArrowLeft, RefreshCw, ShoppingBag, Share2, LogOut } from "lucide-react";

export default function SellerDashboard({ onBackToCreator, user, token, onLogout, onRequestLogin }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const fetchProducts = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/products/all", authHeaders);
      setProducts(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        alert("Session expired. Please log in again.");
        onLogout();
      } else {
        alert("Failed to load inventory: " + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "available" ? "sold_out" : "available";
    try {
      await axios.patch(`http://127.0.0.1:5000/api/products/${id}/status`, { status: nextStatus }, authHeaders);
      setProducts((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status: nextStatus } : item))
      );
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/products/${id}`, authHeaders);
      setProducts((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      alert("Failed to delete product: " + (err.response?.data?.error || err.message));
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center", padding: 24 }}>
        <h2>Artisan Inventory Portal</h2>
        <p style={{ color: "#64748b" }}>Please login to manage your published crafts and pricing.</p>
        <button
          onClick={onRequestLogin}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Login / Register
        </button>
      </div>
    );
  }

  // KPI Calculations
  const totalItems = products.length;
  const activeItems = products.filter((p) => p.status !== "sold_out").length;
  const soldItems = products.filter((p) => p.status === "sold_out").length;
  const inventoryValue = products
    .filter((p) => p.status !== "sold_out")
    .reduce((acc, curr) => acc + (curr.pricing?.recommendedPrice || 0), 0);

  return (
    <div style={{ maxWidth: 800, margin: "20px auto", fontFamily: "sans-serif", padding: 16 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: "#1e293b" }}>{user?.name || "Artisan"}'s Workspace</h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>{user?.craftSpecialty || "Craft Studio"} • {user?.phone}</span>
        </div>
        <button
          onClick={onLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #e2e8f0",
            padding: "6px 12px",
            borderRadius: 8,
            cursor: "pointer",
            color: "#dc2626",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Navigation & Refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={onBackToCreator}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #ccc",
            padding: "8px 14px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={18} /> New AI Listing
        </button>
        <button
          onClick={fetchProducts}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#f0f0f0",
            border: "none",
            padding: "8px 14px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
          <span style={{ color: "#64748b", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Package size={16} /> Total Published
          </span>
          <h2 style={{ margin: "8px 0 0 0", color: "#1e293b" }}>{totalItems}</h2>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
          <span style={{ color: "#059669", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <ShoppingBag size={16} /> Ready to Sell
          </span>
          <h2 style={{ margin: "8px 0 0 0", color: "#059669" }}>{activeItems}</h2>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
          <span style={{ color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={16} /> Sold Out
          </span>
          <h2 style={{ margin: "8px 0 0 0", color: "#dc2626" }}>{soldItems}</h2>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 16, borderRadius: 12 }}>
          <span style={{ color: "#d97706", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <IndianRupee size={16} /> Active Stock Value
          </span>
          <h2 style={{ margin: "8px 0 0 0", color: "#d97706" }}>₹{inventoryValue}</h2>
        </div>
      </div>

      {/* Product List */}
      <h3 style={{ marginBottom: 16, color: "#334155" }}>Published Products</h3>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading inventory...</p>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, border: "2px dashed #cbd5e1", borderRadius: 12 }}>
          <p style={{ color: "#64748b" }}>No products published yet in your account.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {products.map((item) => (
            <div
              key={item._id}
              style={{
                display: "flex",
                gap: 16,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                opacity: item.status === "sold_out" ? 0.65 : 1,
              }}
            >
              <img
                src={item.imageUrl || "https://placehold.co/100x100?text=No+Photo"}
                alt={item.titleEn}
                style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>{item.titleEn}</h4>
                    <p style={{ margin: "2px 0 6px 0", color: "#64748b", fontSize: 13 }}>{item.titleHi}</p>
                  </div>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: item.status === "sold_out" ? "#fee2e2" : "#dcfce7",
                      color: item.status === "sold_out" ? "#991b1b" : "#166534",
                    }}
                  >
                    {item.status === "sold_out" ? "Sold Out" : "In Stock"}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                  <span>Fair Price: <strong>₹{item.pricing?.recommendedPrice}</strong></span>
                  <span style={{ margin: "0 8px" }}>•</span>
                  <span>Exhibition: <strong>₹{item.pricing?.exhibitionPrice}</strong></span>
                  <span style={{ margin: "0 8px" }}>•</span>
                  <span style={{ color: "#b45309" }}>Floor: ₹{item.pricing?.floorPrice}</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleStatus(item._id, item.status)}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: item.status === "sold_out" ? "#0284c7" : "#059669",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {item.status === "sold_out" ? "Mark In-Stock" : "Mark as Sold"}
                  </button>

                  <button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `*${item.titleEn}*\n` +
                        `Price: ₹${item.pricing?.recommendedPrice}\n` +
                        `Category: ${item.category} (${item.material})\n\n` +
                        `${item.descriptionEn}\n\n` +
                        `Photo: ${item.imageUrl}`
                      );
                      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
                    }}
                    style={{
                      fontSize: 12,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #25D366",
                      background: "#fff",
                      color: "#25D366",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                  >
                    <Share2 size={14} /> WhatsApp
                  </button>

                  <button
                    onClick={() => deleteProduct(item._id)}
                    style={{
                      fontSize: 12,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #fee2e2",
                      background: "#fff",
                      color: "#dc2626",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}