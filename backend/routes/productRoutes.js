import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import PricingBenchmark from "../models/PricingBenchmark.js";
import { pricingService } from "../services/pricingService.js";
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

// ============================================================================
// 1. Dynamic Dropdown Options directly from MongoDB Pricing Benchmark Dataset
// ============================================================================
router.get("/dataset-options", async (req, res) => {
  try {
    const benchmarks = await PricingBenchmark.find(
      {},
      {
        category: 1,
        productName: 1,
        material: 1,
        rawMaterialCost: 1,
        laborHours: 1,
        minRawCost: 1,
        maxRawCost: 1,
        minHours: 1,
        maxHours: 1,
      }
    ).sort({ category: 1, productName: 1 });

    // Group items and materials dynamically by category
    const categoryMap = {};

    benchmarks.forEach((doc) => {
      const cat = doc.category || "Handicrafts";
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          items: [],
          materials: new Set(),
        };
      }

      // Add item record with its baseline metrics
      categoryMap[cat].items.push({
        productName: doc.productName,
        material: doc.material || "Handcrafted Material",
        rawMaterialCost: doc.rawMaterialCost || doc.minRawCost || 0,
        laborHours: doc.laborHours || doc.minHours || 1,
        minRawCost: doc.minRawCost || 0,
        maxRawCost: doc.maxRawCost || 0,
        minHours: doc.minHours || 0,
        maxHours: doc.maxHours || 0,
      });

      // Split comma/slash separated materials into clean options
      if (doc.material) {
        doc.material.split(/[,/]+/).forEach((m) => {
          const clean = m.trim();
          if (clean) categoryMap[cat].materials.add(clean);
        });
      }
    });

    // Format for client consumption
    const categories = Object.keys(categoryMap).sort();
    const formattedData = {};

    categories.forEach((cat) => {
      formattedData[cat] = {
        items: categoryMap[cat].items,
        materials: Array.from(categoryMap[cat].materials).sort(),
      };
    });

    return res.json({
      categories,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching dataset dropdown options:", error);
    return res.status(500).json({ error: "Failed to load dataset options" });
  }
});

// ============================================================================
// 2. Process Voice + AI Extraction + Dataset-Assisted Fair Pricing
// ============================================================================
router.post("/process-voice", upload.any(), async (req, res) => {
  // Check if audio file was uploaded
  const audioFile = req.files?.find((f) => f.fieldname === "audio");
  const uploadedFilePath = audioFile ? audioFile.path : null;

  try {
    const { manualNotes, manualRawCost, manualHours, location, craftSpecialty, category, material } = req.body;
    let voiceText = "";

    // Step A: Transcribe audio with Groq Whisper if present
    if (uploadedFilePath && process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
Category: ${category || "Infer from context"}
Material: ${material || "Infer from context"}
User Specified Raw Material Cost: ${manualRawCost ? `₹${manualRawCost}` : "Extract from context"}
User Specified Labor Hours: ${manualHours ? `${manualHours} hours` : "Extract from context"}
    `.trim();

    // Step B: Default baseline fields for resilient fallback
    let parsed = {
      titleEn: manualNotes ? manualNotes.split(".")[0].slice(0, 40) : "Handcrafted Artisan Item",
      titleHi: "हस्तनिर्मित पारंपरिक शिल्प",
      category: category || "Pottery & Terracotta",
      material: material || "Natural / Handcrafted Material",
      descriptionEn: manualNotes || "Authentic artisanal item handcrafted using traditional techniques.",
      descriptionHi: "कुशल कारीगरों द्वारा पारंपरिक कला से तैयार किया गया प्रामाणिक उत्पाद।",
      rawCost: Number(manualRawCost) || 150,
      hours: Number(manualHours) || 4,
    };

    // Step C: Structured AI generation using Groq LLaMA
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
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
  "category": "Standard category name",
  "material": "Primary material used",
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

        if (category) parsed.category = category;
        if (material) parsed.material = material;
      } catch (aiErr) {
        console.warn("Groq listing parse fallback triggered:", aiErr.message);
        if (manualNotes) {
          parsed.titleEn = manualNotes.split(/[.,\n]/)[0].trim().slice(0, 40);
          parsed.descriptionEn = manualNotes.trim();
        }
      }
    }

    // Step D: Run Dataset-Assisted Fair Pricing Algorithm
    const finalRawCost = Number(manualRawCost) || Number(parsed.rawCost) || 150;
    const finalHours = Number(manualHours) || Number(parsed.hours) || 4;

    const pricingCalculation = await pricingService.generateFairPricing({
      title: parsed.titleEn,
      category: parsed.category,
      material: parsed.material,
      craftSpecialty: craftSpecialty || parsed.category,
      location: location || "India",
      rawMaterialCost: finalRawCost,
      laborHours: finalHours,
    });

    return res.json({
      ...parsed,
      rawCost: finalRawCost,
      hours: finalHours,
      ...pricingCalculation,
    });
  } catch (error) {
    safeUnlink(uploadedFilePath);
    console.error("Backend process-voice error:", error);
    return res.status(500).json({ error: error.message || "Failed to process voice and details" });
  }
});

// ============================================================================
// 3. Validate Artisan Desired Price Against Fair Range (The Flowchart Engine)
// ============================================================================
router.post("/validate-seller-price", async (req, res) => {
  try {
    const { sellerPrice, pricing } = req.body;
    if (!sellerPrice || !pricing) {
      return res.status(400).json({ error: "sellerPrice and pricing range are required." });
    }

    const validation = pricingService.validateSellerPrice(sellerPrice, pricing);
    return res.json(validation);
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(500).json({ error: "Price validation calculation failed." });
  }
});

// ============================================================================
// 4. Upload Photo Route (Returns relative path only)
// ============================================================================
router.post("/upload-photo", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Photo is required." });
    }

    // Return clean relative path without hardcoded protocols, hosts, or local IPs
    const imageUrl = `/uploads/${req.file.filename}`;
    return res.json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 5. Save Product to DB + Conditionally Export to Excel if Category is Brand New
// ============================================================================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const {
      titleEn,
      titleHi,
      category,
      material,
      descriptionEn,
      descriptionHi,
      imageUrl,
      rawCost,
      hours,
      pricing,
      sellerPrice,
    } = req.body;

    const finalPrice = Number(sellerPrice) || pricing?.recommendedPrice || 0;
    const normalizedCategory = (category || "Handicrafts").trim();

    // Sanitize imageUrl to ensure no local IPs or loopback URLs get saved to DB
    let cleanImageUrl = imageUrl || "";
    if (cleanImageUrl) {
      // Strip out http://localhost:5000, http://127.0.0.1:5000, or http://10.x.x.x:5000
      cleanImageUrl = cleanImageUrl.replace(/^http:\/\/[^/]+/, "");
      // Ensure it starts with / if it's a relative path
      if (!cleanImageUrl.startsWith("http://") && !cleanImageUrl.startsWith("https://") && !cleanImageUrl.startsWith("/")) {
        cleanImageUrl = `/${cleanImageUrl}`;
      }
    }

    // 1. Check if the category exists in the baseline benchmarks BEFORE inserting
    const isExistingCategory = await pricingService.doesCategoryExist(normalizedCategory);

    // 2. Create and save active product listing
    const product = new Product({
      artisan: req.user.id,
      titleEn,
      titleHi,
      category: normalizedCategory,
      material,
      descriptionEn,
      descriptionHi,
      imageUrl: cleanImageUrl,
      rawCost: Number(rawCost) || 0,
      hours: Number(hours) || 0,
      pricing: {
        floorPrice: pricing?.floorPrice || Math.round(finalPrice * 0.8),
        recommendedPrice: finalPrice,
        exhibitionPrice: pricing?.exhibitionPrice || Math.round(finalPrice * 1.25),
      },
      status: "available",
    });

    const savedProduct = await product.save();

    // 3. Prepare benchmark payload
    const benchmarkPayload = {
      productName: titleEn,
      category: normalizedCategory,
      material: material || "Traditional",
      craftSpecialty: req.user.craftSpecialty || normalizedCategory,
      rawMaterialCost: Number(rawCost) || 0,
      laborHours: Number(hours) || 0,
      hourlyRate: pricing?.hourlyRate || 85,
      productionCost: pricing?.totalProductionCost || (Number(rawCost) + Number(hours) * 85),
      floorPrice: pricing?.floorPrice || Math.round(finalPrice * 0.8),
      fairPrice: finalPrice,
      premiumPrice: pricing?.exhibitionPrice || Math.round(finalPrice * 1.25),
      location: req.user.location || "India",
      artisanId: req.user.id,
      verified: true,
    };

    try {
      // Save to MongoDB collection for active self-learning
      await PricingBenchmark.create(benchmarkPayload);

      // ONLY write to Excel if category did NOT previously exist in the dataset!
      if (!isExistingCategory) {
        await pricingService.appendToNewDataExcel(benchmarkPayload);
        console.log(`[NEW CATEGORY DISCOVERED] "${normalizedCategory}" saved to New_Artisan_Contributions.xlsx`);
      } else {
        console.log(`[KNOWN CATEGORY] "${normalizedCategory}" already exists in master dataset. Not exported to Excel.`);
      }
    } catch (benchErr) {
      console.warn("Could not record benchmark entry:", benchErr.message);
    }

    return res.status(201).json(savedProduct);
  } catch (error) {
    console.error("Save product error:", error);
    return res.status(500).json({ error: error.message || "Failed to save product" });
  }
});

// ============================================================================
// 6. Retrieve All Products for the Logged-In Artisan
// ============================================================================
router.get("/all", verifyToken, async (req, res) => {
  try {
    const products = await Product.find({ artisan: req.user.id }).sort({ createdAt: -1 });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 7. Toggle Stock Status
// ============================================================================
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

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 8. Delete Product Listing
// ============================================================================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({
      _id: req.params.id,
      artisan: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Product not found or unauthorized." });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 9. Public Discovery Marketplace for Buyers
// ============================================================================
router.get("/public/marketplace", async (req, res) => {
  try {
    const products = await Product.find({ status: "available" })
      .populate("artisan", "name craftSpecialty location phone")
      .sort({ createdAt: -1 });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 10. Buyer Counter-Offer / Ethical Bargain Evaluation Engine
// ============================================================================
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
      message = "Your offer covers basic material and standard wage costs, but falls below fair valuation. A reasonable compromise is suggested below.";
      counterOffer = Math.round((offer + recommended) / 2);
    } else {
      status = "rejected_below_floor";
      const laborCut = Math.round(((floor - offer) / floor) * 100);
      message = `This offer is below the artisan's break-even floor price (₹${floor}). Accepting ₹${offer} would effectively cut the artisan's skilled labor wage by ~${laborCut}%.`;
      counterOffer = floor;
    }

    return res.json({
      status,
      message,
      suggestedCounter: counterOffer,
      floorPrice: floor,
      recommendedPrice: recommended,
      artisanContact: product.artisan?.phone,
      artisanName: product.artisan?.name,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 11. Buyer Checkout & Place Order
// ============================================================================
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

    return res.status(201).json({ message: "Order placed successfully!", order });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 12. Buyer Order History
// ============================================================================
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate("product")
      .populate("artisan", "name phone")
      .sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Support both named and default imports
export { router as productRoutes };
export default router;