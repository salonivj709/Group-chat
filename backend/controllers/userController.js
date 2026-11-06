const db = require("../config/db");

// Search for one registered Gather user by email, excluding the signed-in user.
exports.findByEmail = async (req, res) => {
  try {
    const email = typeof req.query.email === "string"
      ? req.query.email.trim().toLowerCase()
      : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const [users] = await db.execute(
      "SELECT id, name, email FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [email, Number(req.user.id)]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: "No other Gather user was found with that email." });
    }

    return res.status(200).json({ success: true, user: users[0] });
  } catch (error) {
    console.error("Find user by email error:", error);
    return res.status(500).json({ success: false, message: "Unable to search for that user right now." });
  }
};
