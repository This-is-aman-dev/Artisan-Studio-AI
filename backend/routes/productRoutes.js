import express from "express";
import multer from "multer";
import fs from "fs";
import Groq from "groq-sdk";
import Product from "../models/Product.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `${UPLOADS_DIR}/`);
  },
  filename: (req, file, cb) => {
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${cleanFileName}`);
  },
});
const upload = multer({ storage });

// Helper to safely delete temp files
const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("Could not delete temporary file:", err.message);
    }
  }
};

// 1. Process Voice + Manual Costing Route (Groq AI)
router.post("/process-voice", upload.single("audio"), async (req, res) => {
  const uploadedFilePath = req.file ? req.file.path : null;

  try {
    const { manualNotes, manualRawCost, manualHours } = req.body;
    let voiceText = "";

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured in .env" });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Step A: Transcribe audio if present
    if (uploadedFilePath) {
      try {
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(uploadedFilePath),
          model: "whisper-large-v3",
        });
        voiceText = transcription.text || "";
      } catch (transcribeErr) {
        console.warn("Whisper audio transcription warning:", transcribeErr.message);
      } finally {
        safeUnlink(uploadedFilePath);
      }
    }

    const combinedContext = `
Voice Input: ${voiceText || "None"}
Manual Notes: ${manualNotes || "None"}
User Specified Raw Material Cost: ${manualRawCost ? `₹${manualRawCost}` : "Extract from context"}
User Specified Labor Hours: ${manualHours ? `${manualHours} hours` : "Extract from context"}
    `.trim();

    // Step B: Default baseline fields for resilient fallback
    let parsed = {
      titleEn: manualNotes ? manualNotes.split(".")[0].slice(0, 40) : "Handcrafted Artisan Item",
      titleHi: "हस्तनिर्मित पारंपरिक शिल्प",
      category: "Handicrafts & Decor",
      material: "Natural / Handcrafted Material",
      descriptionEn: manualNotes || "Authentic artisanal item handcrafted using traditional techniques.",
      descriptionHi: "कुशल कारीगरों द्वारा पारंपरिक कला से तैयार किया गया प्रामाणिक उत्पाद।",
      rawCost: Number(manualRawCost) || 150,
      hours: Number(manualHours) || 4,
    };

    // Step C: Attempt structured AI generation with standard, high-limit model
    try {
      const selectedModel = "llama-3.1-8b-instant"; // Fast with high token allowances

      const completion = await groq.chat.completions.create({
        model: selectedModel,
        response_format: { type: "json_object" },
        max_tokens: 450,
        messages: [
          {
            role: "system",
            content: `You extract e-commerce listing details for Indian micro-entrepreneurs and artisans.
Return ONLY valid JSON with this schema:
{
  "titleEn": "Concise product title in English (max 6 words)",
  "titleHi": "हिंदी शीर्षक (अधिकतम 6 शब्द)",
  "category": "Handloom / Terracotta / Metal / Woodcraft / Jewelry",
  "material": "Material used",
  "descriptionEn": "Compelling story under 50 words",
  "descriptionHi": "संक्षिप्त हिंदी विवरण 50 शब्दों में",
  "rawCost": 0,
  "hours": 0
}`,
          },
          {
            role: "user",
            content: combinedContext,
          },
        ],
      });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      const cleanContent = rawContent.replace(/^```json/g, "").replace(/```$/g, "").trim();
      const aiParsed = JSON.parse(cleanContent);
      parsed = { ...parsed, ...aiParsed };
    } catch (aiErr) {
      console.warn("Groq listing parse fallback triggered:", aiErr.message);
      if (manualNotes) {
        parsed.titleEn = manualNotes.split(/[.,\n]/)[0].trim().slice(0, 40);
        parsed.descriptionEn = manualNotes.trim();
      }
    }

    // Step D: Calculate 3-tier pricing
    const rawCost = Number(manualRawCost) || Number(parsed.rawCost) || 150;
    const hours = Number(manualHours) || Number(parsed.hours) || 4;
    const baseCost = rawCost + hours * 85; // ₹85/hr skilled craft benchmark

    const pricing = {
      floorPrice: Math.round(baseCost * 1.1),
      recommendedPrice: Math.round(baseCost * 1.35),
      exhibitionPrice: Math.round(baseCost * 1.7),
    };

    return res.json({
      ...parsed,
      rawCost,
      hours,
      pricing,
    });
  } catch (error) {
    safeUnlink(uploadedFilePath);
    console.error("Backend process-voice error:", error);
    return res.status(500).json({ error: error.message || "Failed to process voice and details" });
  }
});

// 2. Upload Photo Route
router.post("/upload-photo", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Photo is required." });
    }
    const host = req.get("host");
    const protocol = req.protocol;
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    return res.json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Save Product to Database (Protected: Attaches logged-in Artisan ID)
router.post("/save", verifyToken, async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      artisan: req.user.id, // Linked to logged-in user
    });
    const savedProduct = await product.save();
    return res.status(201).json(savedProduct);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Retrieve All Products for the Logged-In Artisan
router.get("/all", verifyToken, async (req, res) => {
  try {
    const products = await Product.find({ artisan: req.user.id }).sort({ createdAt: -1 });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Toggle stock status (Protected: verifies artisan ownership)
router.patch("/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    if (status === "sold_out") {
      updateData.soldAt = new Date();
    } else {
      updateData.soldAt = null;
    }

    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, artisan: req.user.id },
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Product not found or unauthorized." });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a product listing (Protected: verifies artisan ownership)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({
      _id: req.params.id,
      artisan: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Product not found or unauthorized." });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public Endpoint for Buyers: View all available crafts with artisan details populated
router.get("/public/marketplace", async (req, res) => {
  try {
    const products = await Product.find({ status: "available" })
      .populate("artisan", "name craftSpecialty location phone")
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Counter-Offer / Fair-Price Evaluation Engine (For Buyers)
router.post("/:id/evaluate-offer", async (req, res) => {
  try {
    const { buyerOffer } = req.body;
    const product = await Product.findById(req.params.id).populate("artisan", "name craftSpecialty phone");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const offer = Number(buyerOffer);
    const floor = product.pricing.floorPrice;
    const recommended = product.pricing.recommendedPrice;

    let status = "";
    let message = "";
    let counterOffer = null;

    if (offer >= recommended) {
      status = "accepted_fair";
      message = "Your offer meets or exceeds the artisan's fair market valuation. Thank you for supporting sustainable artisan livelihoods!";
      counterOffer = offer;
    } else if (offer >= floor) {
      status = "negotiable";
      message = `Your offer covers basic material and standard wage costs, but falls below fair valuation. A reasonable compromise is suggested below.`;
      counterOffer = Math.round((offer + recommended) / 2);
    } else {
      status = "rejected_below_floor";
      const laborCut = Math.round(((floor - offer) / floor) * 100);
      message = `This offer is below the artisan's break-even floor price (₹${floor}). Accepting ₹${offer} would effectively cut the artisan's skilled labor wage by ~${laborCut}%.`;
      counterOffer = floor;
    }

    res.json({
      status,
      message,
      suggestedCounter: counterOffer,
      floorPrice: floor,
      recommendedPrice: recommended,
      artisanContact: product.artisan?.phone,
      artisanName: product.artisan?.name,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

import Order from "../models/Order.js";

// Buyer places an order
router.post("/buy", verifyToken, async (req, res) => {
  try {
    const { productId, finalPrice, shippingAddress } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const order = await Order.create({
      buyer: req.user.id,
      artisan: product.artisan,
      product: productId,
      finalPrice,
      shippingAddress,
    });

    // Mark product as sold
    product.status = "sold_out";
    product.soldAt = new Date();
    await product.save();

    res.status(201).json({ message: "Order placed successfully!", order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buyer views their past orders
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate("product")
      .populate("artisan", "name phone")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Support both named and default imports in server.js
export { router as productRoutes };
export default router;