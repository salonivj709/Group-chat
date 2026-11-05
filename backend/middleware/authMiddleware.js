const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required. Please log in again."
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing from backend environment variables.");
    return res.status(500).json({
      success: false,
      message: "Server authentication is not configured."
    });
  }

  try {
    const token = authHeader.slice("Bearer ".length).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please log in again."
    });
  }
};
