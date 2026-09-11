import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ShoppingBag,
  User,
  MapPin,
  Scale,
  CheckCircle,
  AlertCircle,
  Package,
  CreditCard,
  X,
  LogOut,
} from "lucide-react";

export default function BuyerPortal({ user, token, onLogout, onRequestLogin }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" | "orders"
  const [loading, setLoading] = useState(true);

  // Negotiation modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [offerInput, setOfferInput] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  // Checkout modal
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [checkoutPrice, setCheckoutPrice] = useState(0);
  const [shipping, setShipping] = useState({
    fullName: user?.name || "",
    phone: user?.phone || "",
    street: "",
    city: "",
    pincode: "",
  });
  const [buying, setBuying] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchMarketplace = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/products/public/marketplace");
      setProducts(res.data);
    } catch (err) {
      console.error("Marketplace fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!token) return;
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/products/my-orders", authHeaders);
      setOrders(res.data);
    } catch (err) {
      console.error("Orders fetch error:", err);
    }
  };

  useEffect(() => {
    fetchMarketplace();
    if (token) fetchOrders();
  }, [token]);

  const handleEvaluateOffer = async (e) => {
    e.preventDefault();
    if (!offerInput || !selectedProduct) return;
    setEvaluating(true);
    setEvalResult(null);

    try {
      const res = await axios.post(
        `http://127.0.0.1:5000/api/products/${selectedProduct._id}/evaluate-offer`,
        { buyerOffer: Number(offerInput) }
      );
      setEvalResult(res.data);
    } catch (err) {
      alert("Evaluation failed: " + (err.response?.data?.error || err.message));
    } finally {
      setEvaluating(false);
    }
  };

  const startCheckout = (product, price) => {
    if (!token) {
      onRequestLogin();
      return;
    }
    setSelectedProduct(null);
    setCheckoutItem(product);
    setCheckoutPrice(price);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setBuying(true);
    try {
      await axios.post(
        "http://127.0.0.1:5000/api/products/buy",
        {
          productId: checkoutItem._id,
          finalPrice: checkoutPrice,
          shippingAddress: shipping,
        },
        authHeaders
      );

      alert("🎉 Order placed successfully! The artisan has been notified.");
      setCheckoutItem(null);
      fetchMarketplace();
      fetchOrders();
      setActiveTab("orders");
    } catch (err) {
      alert("Checkout failed: " + (err.response?.data?.error || err.message));
    } finally {
      setBuying(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      {/* Buyer Navbar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #0f766e",
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#0f766e", color: "#fff", padding: 8, borderRadius: 8 }}>
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, color: "#0f766e" }}>Artisan Direct Marketplace</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Authentic handcrafted goods directly from rural Indian creators
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {token && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: activeTab === "catalog" ? "#0f766e" : "#f1f5f9",
                  color: activeTab === "catalog" ? "#fff" : "#475569",
                }}
              >
                Browse Crafts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: activeTab === "orders" ? "#0f766e" : "#f1f5f9",
                  color: activeTab === "orders" ? "#fff" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Package size={14} /> My Orders ({orders.length})
              </button>
            </div>
          )}

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 10 }}>
              <span style={{ fontSize: 13, color: "#0f766e", fontWeight: 600 }}>
                👤 {user.name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "7px 12px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestLogin}
              style={{
                background: "#0f766e",
                color: "#fff",
                border: "none",
                padding: "9px 18px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sign In as Buyer
            </button>
          )}
        </div>
      </header>

      {/* Hero Explainer Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
          border: "1px solid #99f6e4",
          borderRadius: 12,
          padding: 18,
          marginBottom: 26,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ background: "#0f766e", color: "#fff", padding: 12, borderRadius: 10 }}>
          <Scale size={28} />
        </div>
        <div>
          <h3 style={{ margin: 0, color: "#115e59", fontSize: 16 }}>
            Ethical Direct Trade & Counter-Bargain Engine
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#334155" }}>
            100% of purchase proceeds go directly to verified artisans. Want to negotiate? Use our
            ethical AI bargain calculator to propose a fair counter-offer that protects artisan living wages.
          </p>
        </div>
      </div>

      {/* VIEW 1: CATALOG */}
      {activeTab === "catalog" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>Available Artisan Crafts</h2>
            <span style={{ fontSize: 13, color: "#64748b" }}>{products.length} crafts listed</span>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "#64748b", padding: 40 }}>Loading crafts from master artisans...</p>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, border: "2px dashed #cbd5e1", borderRadius: 12 }}>
              <p style={{ color: "#64748b", fontSize: 15 }}>No items currently available. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 22 }}>
              {products.map((item) => (
                <div
                  key={item._id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                >
                  <img
                    src={item.imageUrl || "https://placehold.co/400x260?text=Handcrafted+Item"}
                    alt={item.titleEn}
                    style={{ width: "100%", height: 210, objectFit: "cover" }}
                  />

                  <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {item.category} • {item.material}
                    </div>
                    <h3 style={{ margin: "6px 0 2px 0", fontSize: 17, color: "#0f172a" }}>{item.titleEn}</h3>
                    <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>{item.titleHi}</p>

                    <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.45, flex: 1 }}>{item.descriptionEn}</p>

                    {/* Artisan Signature Card */}
                    <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, margin: "14px 0", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        <User size={14} color="#0f766e" /> Made by {item.artisan?.name || "Traditional Artisan"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        <MapPin size={12} /> {item.artisan?.location || "India"} • {item.artisan?.craftSpecialty || "Craft Studio"}
                      </div>
                    </div>

                    {/* Price & Action Buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <div>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Fair Trade Price</span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "#0f766e" }}>
                          ₹{item.pricing?.recommendedPrice}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(item);
                            setOfferInput("");
                            setEvalResult(null);
                          }}
                          style={{
                            background: "#f0fdfa",
                            color: "#0f766e",
                            border: "1px solid #0f766e",
                            padding: "8px 12px",
                            borderRadius: 6,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Bargain
                        </button>
                        <button
                          type="button"
                          onClick={() => startCheckout(item, item.pricing?.recommendedPrice)}
                          style={{
                            background: "#0f766e",
                            color: "#fff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: 6,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: ORDERS */}
      {activeTab === "orders" && (
        <div>
          <h2 style={{ fontSize: 18, color: "#1e293b", marginBottom: 16 }}>My Purchases</h2>
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, border: "2px dashed #cbd5e1", borderRadius: 12 }}>
              <Package size={40} color="#94a3b8" style={{ margin: "0 auto 10px" }} />
              <p style={{ color: "#64748b" }}>You haven't purchased any crafts yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Browse Crafts
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {orders.map((ord) => (
                <div
                  key={ord._id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <img
                      src={ord.product?.imageUrl || "https://placehold.co/80x80"}
                      alt={ord.product?.titleEn || "Purchased Craft"}
                      style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }}
                    />
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>{ord.product?.titleEn}</h4>
                      <p style={{ margin: "2px 0 4px 0", fontSize: 13, color: "#64748b" }}>
                        Artisan: {ord.artisan?.name} ({ord.artisan?.phone})
                      </p>
                      <span style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }}>
                        Ordered on {new Date(ord.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Paid Amount</span>
                    <h3 style={{ margin: 0, color: "#0f766e", fontSize: 18 }}>₹{ord.finalPrice}</h3>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#dcfce7",
                        color: "#15803d",
                      }}
                    >
                      ✓ Order Confirmed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: FAIR BARGAIN ENGINE */}
      {selectedProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24, position: "relative" }}>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 4px 0", color: "#0f172a" }}>Fair Trade Bargaining</h3>
            <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: 13 }}>
              {selectedProduct.titleEn} by {selectedProduct.artisan?.name}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: "#64748b" }}>Artisan Fair Price</span>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#0f766e" }}>₹{selectedProduct.pricing?.recommendedPrice}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "#64748b" }}>Living Wage Floor</span>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#b45309" }}>₹{selectedProduct.pricing?.floorPrice}</div>
              </div>
            </div>

            <form onSubmit={handleEvaluateOffer}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Propose Your Buying Price (₹)</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="number"
                  required
                  placeholder="e.g. 750"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
                <button
                  type="submit"
                  disabled={evaluating}
                  style={{ background: "#0f766e", color: "#fff", border: "none", padding: "0 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                >
                  {evaluating ? "Evaluating..." : "Check Fairness"}
                </button>
              </div>
            </form>

            {evalResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid",
                  borderColor: evalResult.status === "rejected_below_floor" ? "#fecaca" : "#a7f3d0",
                  background: evalResult.status === "rejected_below_floor" ? "#fff1f2" : "#f0fdf4",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 700,
                    fontSize: 13,
                    color: evalResult.status === "rejected_below_floor" ? "#be123c" : "#15803d",
                  }}
                >
                  {evalResult.status === "rejected_below_floor" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                  {evalResult.status === "rejected_below_floor" ? "Offer Below Living Wage Floor" : "Fair Counter-Offer Agreed"}
                </div>
                <p style={{ fontSize: 12.5, color: "#334155", margin: "6px 0 12px 0", lineHeight: 1.4 }}>
                  {evalResult.message}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Final Price: ₹{evalResult.suggestedCounter}</span>
                  <button
                    type="button"
                    onClick={() => startCheckout(selectedProduct, evalResult.suggestedCounter)}
                    style={{
                      background: "#0f766e",
                      color: "#fff",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Buy at ₹{evalResult.suggestedCounter}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: BUY / CHECKOUT MODAL */}
      {checkoutItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24, position: "relative" }}>
            <button
              type="button"
              onClick={() => setCheckoutItem(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>Confirm Purchase</h3>
            <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: 13 }}>
              {checkoutItem.titleEn} • <strong>₹{checkoutPrice}</strong>
            </p>

            <form onSubmit={handlePlaceOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Recipient Full Name</label>
                <input
                  type="text"
                  required
                  value={shipping.fullName}
                  onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}
                  style={{ width: "100%", padding: 9, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Delivery Phone Number</label>
                <input
                  type="tel"
                  required
                  value={shipping.phone}
                  onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                  style={{ width: "100%", padding: 9, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Delivery Address & Street</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 14B, Green Avenue"
                  value={shipping.street}
                  onChange={(e) => setShipping({ ...shipping, street: e.target.value })}
                  style={{ width: "100%", padding: 9, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaipur"
                    value={shipping.city}
                    onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                    style={{ width: "100%", padding: 9, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Pincode</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 302001"
                    value={shipping.pincode}
                    onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
                    style={{ width: "100%", padding: 9, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#475569" }}>
                Payment Method: <strong>Direct Artisan UPI / Cash on Delivery</strong>
              </div>

              <button
                type="submit"
                disabled={buying}
                style={{
                  marginTop: 6,
                  padding: 12,
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: buying ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <CreditCard size={16} /> {buying ? "Processing..." : `Confirm Order for ₹${checkoutPrice}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}