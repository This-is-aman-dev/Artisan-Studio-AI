import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    artisan: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    finalPrice: { type: Number, required: true },
    shippingAddress: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      pincode: String,
    },
    status: { type: String, default: "confirmed" }, // confirmed, shipped, delivered
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);