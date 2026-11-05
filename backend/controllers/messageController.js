const db = require("../config/db");

exports.getMessages = async (req, res) => {
  try {
    const [messages] = await db.execute(
      `SELECT m.id, m.user_id AS userId, u.name AS senderName,
              m.message, m.created_at AS createdAt
       FROM messages m
       INNER JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 300`
    );
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch messages." });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }
    if (message.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "Message must be 2000 characters or fewer." });
    }

    const [result] = await db.execute(
      "INSERT INTO messages (user_id, message) VALUES (?, ?)",
      [req.user.id, message.trim()]
    );
    const [rows] = await db.execute(
      `SELECT m.id, m.user_id AS userId, u.name AS senderName,
              m.message, m.created_at AS createdAt
       FROM messages m INNER JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, message: "Message sent.", data: rows[0] });
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({ success: false, message: "Unable to send message." });
  }
};
