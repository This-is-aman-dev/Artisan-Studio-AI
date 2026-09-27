import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";

// Service imports
import { pricingService } from "./services/pricingService.js";

// Load environment variables from .env
dotenv.config();

// 1. Initialize Express app
const app = express();

// 2. ESM Directory & Path Resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists so static file serving never throws ENOENT
const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// 3. Middlewares
app.use(cors({ origin: "*" }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve uploaded product photos publicly
app.use("/uploads", express.static(uploadsPath));

// 4. Mount API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Artisan Studio AI API is up and running!");
});

// Debug route to see what files exist on Render's disk
app.get("/debug-uploads", (req, res) => {
  try {
    const resolvedPath = path.resolve(uploadsPath);
    const exists = fs.existsSync(resolvedPath);

    let files = [];

    if (exists) {
      files = fs.readdirSync(resolvedPath);
    }

    res.json({
      __dirname,
      uploadsPath,
      resolvedPath,
      exists,
      fileCount: files.length,
      sampleFiles: files.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 5. Database Connection & Server Listener
const PORT = process.env.PORT || 5000;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/artisan_studio_db";

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB database: artisan_studio_db");

    // Load benchmarks from Artisan_Dataset_Cleaned.xlsx
    try {
      await pricingService.seedFromExcel();
    } catch (seedErr) {
      console.warn("Dataset seed warning:", seedErr.message);
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Server running on port ${PORT} (All interfaces: 0.0.0.0)`
      );
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });