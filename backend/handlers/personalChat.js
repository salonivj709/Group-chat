const db = require("../config/db");

const crypto = require("crypto");

function getPrivateRoomId(userA, userB) {
  const identifiers = [
    String(userA).trim().toLowerCase(),
    String(userB).trim().toLowerCase()
  ].sort();

  const combinedId = identifiers.join("::");

  const hash = crypto
    .createHash("sha256")
    .update(combinedId)
    .digest("hex");

  return `private_${hash}`;
}

module.exports = function registerPersonalChatHandlers(io, socket) {
  socket.on("join_room", async (payload = {}, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const currentUserId = Number(socket.data.user.id);
      const recipientId = Number(payload.recipientId);

      if (!Number.isSafeInteger(recipientId) || recipientId <= 0) {
        return reply({ success: false, message: "Select a valid Gather user first." });
      }
      if (recipientId === currentUserId) {
        return reply({ success: false, message: "You cannot start a personal chat with yourself." });
      }

      const [users] = await db.execute(
        "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
        [recipientId]
      );
      if (!users.length) {
        return reply({ success: false, message: "The selected user no longer exists." });
      }

      // A socket should be in only one active personal-chat room at a time.
      if (socket.data.personalRoom) {
        await socket.leave(socket.data.personalRoom);
      }

      const roomId = getPrivateRoomId(currentUserId, recipientId);
      await socket.join(roomId);
      socket.data.personalRoom = roomId;
      socket.data.personalRecipientId = recipientId;

      // Load both directions of this one-to-one conversation in chronological order.
      const [history] = await db.execute(
        `SELECT
           pm.id,
           pm.sender_id AS senderId,
           sender.name AS senderName,
           pm.receiver_id AS recipientId,
           receiver.name AS recipientName,
           pm.message,
           pm.created_at AS createdAt
         FROM personal_messages pm
         INNER JOIN users sender ON sender.id = pm.sender_id
         INNER JOIN users receiver ON receiver.id = pm.receiver_id
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?)
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at ASC, pm.id ASC`,
        [currentUserId, recipientId, recipientId, currentUserId]
      );

      console.log(`User ${currentUserId} joined personal room ${roomId}.`);
      return reply({
        success: true,
        roomId,
        recipient: users[0],
        messages: history,
        message: `Private chat opened with ${users[0].name}.`
      });
    } catch (error) {
      console.error("join_room error:", error);
      return reply({ success: false, message: "Unable to open the personal chat. Check the database setup." });
    }
  });

  socket.on("leave_room", async (acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};
    try {
      if (socket.data.personalRoom) await socket.leave(socket.data.personalRoom);
      socket.data.personalRoom = null;
      socket.data.personalRecipientId = null;
      reply({ success: true, message: "You left the personal chat." });
    } catch (error) {
      console.error("leave_room error:", error);
      reply({ success: false, message: "Unable to leave the personal chat." });
    }
  });

  socket.on("new_message", async (payload = {}, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const senderId = Number(socket.data.user.id);
      const recipientId = Number(payload.recipientId);
      const message = typeof payload.message === "string" ? payload.message.trim() : "";

      if (!socket.data.personalRoom || recipientId !== Number(socket.data.personalRecipientId)) {
        return reply({ success: false, message: "Open that user's personal chat before sending a message." });
      }
      if (!message) return reply({ success: false, message: "Message cannot be empty." });
      if (message.length > 2000) return reply({ success: false, message: "Message must be 2000 characters or fewer." });

      const [result] = await db.execute(
        "INSERT INTO personal_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
        [senderId, recipientId, message]
      );

      const [rows] = await db.execute(
        `SELECT
           pm.id,
           pm.sender_id AS senderId,
           sender.name AS senderName,
           pm.receiver_id AS recipientId,
           receiver.name AS recipientName,
           pm.message,
           pm.created_at AS createdAt
         FROM personal_messages pm
         INNER JOIN users sender ON sender.id = pm.sender_id
         INNER JOIN users receiver ON receiver.id = pm.receiver_id
         WHERE pm.id = ? LIMIT 1`,
        [result.insertId]
      );

      const savedMessage = rows[0];
      io.to(socket.data.personalRoom).emit("new_message", savedMessage);
      console.log(`Private message ${savedMessage.id} delivered to room ${socket.data.personalRoom}.`);
      return reply({ success: true, data: savedMessage });
    } catch (error) {
      console.error("new_message error:", error);
      return reply({ success: false, message: "Unable to send the personal message." });
    }
  });

  socket.on("disconnect", () => {
    // Socket.IO automatically removes disconnected sockets from all rooms.
    socket.data.personalRoom = null;
    socket.data.personalRecipientId = null;
  });
};
