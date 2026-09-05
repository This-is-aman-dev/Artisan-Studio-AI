# 🎨 Artisan Studio AI

An AI-powered cataloging, multi-tier pricing, and inventory management web application designed for micro-entrepreneurs and rural artisans.

---

## 🚀 Key Features

- **Voice & Craft Analysis:** Natural language cataloging using Groq (Llama-3.1/3.3) and Whisper audio transcription.
- **3-Tier Intelligent Pricing:** Automated calculations for Floor, Recommended (Fair Market), and Exhibition pricing tiers based on material costs and skilled labor hours.
- **Seller Inventory Dashboard:** Real-time stock status management (In Stock vs. Sold Out), valuation metrics, and instant WhatsApp product sharing.
- **Fail-Safe Architecture:** Fallback parsers ensuring uninterrupted demo capability regardless of API rate limits.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Axios, Lucide React
- **Backend:** Node.js, Express, Multer
- **Database:** MongoDB
- **AI Integrations:** Groq SDK (Llama & Whisper)

---

## ⚙️ Local Setup

### 1. Backend Setup
```bash
cd backend
npm install