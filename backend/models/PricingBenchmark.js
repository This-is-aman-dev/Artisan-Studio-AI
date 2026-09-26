import mongoose from "mongoose";

const pricingBenchmarkSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    craftSpecialty: { type: String, trim: true },
    material: { type: String, trim: true },
    dimensions: { type: String, trim: true },
    location: { type: String, trim: true },

    minHours: { type: Number, default: 0 },
    maxHours: { type: Number, default: 0 },
    laborHours: { type: Number, required: true, min: 0 },

    minRawCost: { type: Number, default: 0 },
    maxRawCost: { type: Number, default: 0 },
    rawMaterialCost: { type: Number, required: true, min: 0 },

    hourlyRate: { type: Number, default: 85 },
    productionCost: { type: Number, required: true },
    floorPrice: { type: Number, required: true },
    fairPrice: { type: Number, required: true },
    premiumPrice: { type: Number, required: true },

    verified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("PricingBenchmark", pricingBenchmarkSchema);