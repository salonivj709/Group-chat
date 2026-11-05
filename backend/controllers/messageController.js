const db = require("../config/db");

// Return every saved group message, including the sender's user ID.
exports.getMessages = async (req, res) => {
  try {
    const [messages] = await db.execute(
      `SELECT
         m.id,
         m.user_id AS userId,
         u.name AS senderName,
         m.message,
         m.created_at AS createdAt
       FROM messages AS m
       INNER JOIN users AS u ON u.id = m.user_id
       ORDER BY m.created_at ASC, m.id ASC`
    );

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch messages. Check the messages table and database connection."
    });
  }
};

// Save a message for the currently authenticated user.
exports.createMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be 2000 characters or fewer."
      });
    }

    const [insertResult] = await db.execute(
      "INSERT INTO messages (user_id, message) VALUES (?, ?)",
      [req.user.id, cleanMessage]
    );

    const [rows] = await db.execute(
      `SELECT
         m.id,
         m.user_id AS userId,
         u.name AS senderName,
         m.message,
         m.created_at AS createdAt
       FROM messages AS m
       INNER JOIN users AS u ON u.id = m.user_id
       WHERE m.id = ?`,
      [insertResult.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: rows[0]
    });
  } catch (error) {
    console.error("Create message error:", error);
    return res.status(500).json({ success: false, message: "Unable to send message." });
  }
};
