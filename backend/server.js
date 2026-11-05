require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ success: true, message: "Group Chat API and MySQL are connected." });
  } catch (error) {
    res.status(500).json({ success: false, message: "API is running, but MySQL is unavailable." });
  }
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found." }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Group Chat API running at http://localhost:${PORT}`));
