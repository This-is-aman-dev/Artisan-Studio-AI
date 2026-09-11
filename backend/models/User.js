import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    role: { type: String, enum: ["artisan", "buyer"], default: "artisan" },
    craftSpecialty: { type: String, default: "Traditional Crafts" }, // For artisans
    location: { type: String, default: "India" },
    password: { type: String, required: true },
    resetOtp: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);