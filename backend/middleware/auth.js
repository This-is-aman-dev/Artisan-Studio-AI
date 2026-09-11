import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || "artisan_secret_key_2026");
    req.user = verified; // contains { id, name }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};