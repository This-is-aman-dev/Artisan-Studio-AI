import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    titleEn: { type: String, required: true },
    titleHi: { type: String, default: "" },
    category: { type: String, required: true },
    material: { type: String, default: "" },
    descriptionEn: { type: String, required: true },
    descriptionHi: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    pricing: {
      floorPrice: { type: Number, required: true },
      recommendedPrice: { type: Number, required: true },
      exhibitionPrice: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ["available", "sold_out"],
      default: "available",
    },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);