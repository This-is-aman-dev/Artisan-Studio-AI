import express from "express";
import multer from "multer";
import fs from "fs";
import Groq from "groq-sdk";
import Product from "../models/Product.js";

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

// 1. Process Voice + Manual Costing Route (Groq)
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

    // Step B: Pick an active Groq chat model
    let selectedModel = "llama-3.3-70b-versatile";
    try {
      const modelList = await groq.models.list();
      const activeIds = modelList.data.map((m) => m.id);

      const preferred = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
      ];

      const match = preferred.find((p) => activeIds.includes(p));
      if (match) {
        selectedModel = match;
      } else {
        const fallbackChat = activeIds.find((id) => !id.toLowerCase().includes("whisper"));
        if (fallbackChat) selectedModel = fallbackChat;
      }
    } catch (listErr) {
      console.warn("Using default model fallback:", selectedModel);
    }

    // Step C: Generate structured listing
    const completion = await groq.chat.completions.create({
      model: selectedModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract e-commerce listing details for Indian micro-entrepreneurs and artisans.
Return ONLY valid JSON with this schema:
{
  "titleEn": "SEO-friendly product title in English",
  "titleHi": "हिंदी शीर्षक",
  "category": "Handloom / Terracotta / Metal / Woodcraft / Jewelry",
  "material": "Material used",
  "descriptionEn": "Professional marketplace story and item details",
  "descriptionHi": "हिंदी में आकर्षक विवरण",
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
    // Strip markdown wrappers if present
    const cleanContent = rawContent.replace(/^```json/g, "").replace(/```$/g, "").trim();
    const parsed = JSON.parse(cleanContent);

    // Step D: Calculate tier pricing
    const rawCost = Number(manualRawCost) || Number(parsed.rawCost) || 150;
    const hours = Number(manualHours) || Number(parsed.hours) || 4;
    const baseCost = rawCost + hours * 85; // ₹85/hr skilled benchmark

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

// 2. Upload Photo Route (Dynamic Host/Port)
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

// 3. Save Product to Database
router.post("/save", async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();
    return res.status(201).json(savedProduct);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Retrieve All Products
router.get("/all", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Toggle stock status (Mark as Sold / Mark as Available)
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    if (status === "sold_out") {
      updateData.soldAt = new Date();
    } else {
      updateData.soldAt = null;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a product listing
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Support both named and default imports in server.js
export { router as productRoutes };
export default router;