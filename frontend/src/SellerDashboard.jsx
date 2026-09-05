import React, { useState, useEffect } from "react";
import axios from "axios";
import { Package, IndianRupee, CheckCircle, AlertCircle, Trash2, ArrowLeft, RefreshCw, ShoppingBag } from "lucide-react";

export default function SellerDashboard({ onBackToCreator }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/products/all");
      setProducts(res.data);
    } catch (err) {
      alert("Failed to load inventory: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "available" ? "sold_out" : "available";
    try {
      await axios.patch(`http://127.0.0.1:5000/api/products/${id}/status`, { status: nextStatus });
      setProducts((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status: nextStatus } : item))
      );
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/products/${id}`);
      setProducts((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      alert("Failed to delete product: " + err.message);
    }
  };

  // KPI Calculations
  const totalItems = products.length;
  const activeItems = products.filter((p) => p.status !== "sold_out").length;
  const soldItems = products.filter((p) => p.status === "sold_out").length;
  const inventoryValue = products
    .filter((p) => p.status !== "sold_out")
    .reduce((acc, curr) => acc + (curr.pricing?.recommendedPrice || 0), 0);

  return (
    <div style={{ maxWidth: 800, margin: "20px auto", fontFamily: "sans-serif", padding: 16 }}>
      {/* Top Navigation */}
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
          <p style={{ color: "#64748b" }}>No products published yet.</p>
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

                <div style={{ display: "flex", gap: 8 }}>
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