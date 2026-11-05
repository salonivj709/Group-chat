const db = require("../config/db");

// Save a message and return the complete row used by REST and Socket.IO clients.
exports.saveMessage = async (userId, message) => {
  if (typeof message !== "string" || !message.trim()) {
    const error = new Error("Message cannot be empty.");
    error.status = 400;
    throw error;
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > 2000) {
    const error = new Error("Message must be 2000 characters or fewer.");
    error.status = 400;
    throw error;
  }

  const [insertResult] = await db.execute(
    "INSERT INTO messages (user_id, message) VALUES (?, ?)",
    [userId, cleanMessage]
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

  return rows[0];
};

// Return all saved group messages in chronological order.
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

// REST endpoint retained for compatibility; the frontend now sends through Socket.IO.
exports.createMessage = async (req, res) => {
  try {
    const savedMessage = await exports.saveMessage(req.user.id, req.body.message);
    const broadcastMessage = req.app.get("broadcastMessage");
    if (typeof broadcastMessage === "function") broadcastMessage(savedMessage);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: savedMessage
    });
  } catch (error) {
    console.error("Create message error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to send message."
    });
  }
};
