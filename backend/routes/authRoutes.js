import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "artisan_secret_key_2026";

// 1. Register Route (Supports "artisan" & "buyer" roles)
router.post("/register", async (req, res) => {
  try {
    const { name, phone, password, craftSpecialty, location, role } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Name, phone, and password are required." });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: "User with this phone number already exists." });
    }

    // Default to 'artisan' if not explicitly provided or invalid
    const assignedRole = role === "buyer" ? "buyer" : "artisan";

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      phone,
      role: assignedRole,
      password: hashedPassword,
      craftSpecialty: craftSpecialty || (assignedRole === "artisan" ? "Traditional Crafts" : "N/A"),
      location: location || "India",
    });

    const token = jwt.sign(
      { id: newUser._id, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        craftSpecialty: newUser.craftSpecialty,
        location: newUser.location,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Login Route
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required." });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ error: "Invalid phone number or password." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid phone number or password." });
    }

    const userRole = user.role || "artisan";

    const token = jwt.sign(
      { id: user._id, name: user.name, role: userRole },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: userRole,
        craftSpecialty: user.craftSpecialty,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Request Password Reset OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Please provide your phone number." });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "No account found with this phone number." });
    }

    // Generate a 4-digit OTP valid for 5 minutes
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    // Terminal log for hackathon demo testing
    console.log(`\n================================`);
    console.log(`🔑 PASSWORD RESET OTP for ${phone}: [ ${otp} ]`);
    console.log(`================================\n`);

    res.json({
      message: "OTP sent successfully to your phone.",
      demoOtp: otp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Verify OTP & Set New Password
router.post("/reset-password", async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: "Phone, OTP, and new password are required." });
    }

    const user = await User.findOne({
      phone,
      resetOtp: otp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    res.json({ message: "Password reset successful! You can now log in." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;