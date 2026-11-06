const db = require("../config/db");

function getPrivateRoomId(userA, userB) {
  const ids = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `private_${ids[0]}_${ids[1]}`;
}

module.exports = function registerPersonalChatHandlers(io, socket) {
  // A user can only create a private room with another registered user.
  socket.on("join_room", async (payload = {}, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const currentUserId = Number(socket.data.user.id);
      const recipientId = Number(payload.recipientId);

      if (!Number.isInteger(recipientId) || recipientId <= 0) {
        return reply({ success: false, message: "Enter a valid recipient user ID." });
      }
      if (recipientId === currentUserId) {
        return reply({ success: false, message: "You cannot start a personal chat with yourself." });
      }

      const [users] = await db.execute(
        "SELECT id, name FROM users WHERE id = ? LIMIT 1",
        [recipientId]
      );
      if (!users.length) {
        return reply({ success: false, message: "The recipient user was not found." });
      }

      // Leave the previous private room, if this socket had joined one.
      if (socket.data.personalRoom) {
        await socket.leave(socket.data.personalRoom);
      }

      const roomId = getPrivateRoomId(currentUserId, recipientId);
      await socket.join(roomId);
      socket.data.personalRoom = roomId;
      socket.data.personalRecipientId = recipientId;
      console.log(`User ${currentUserId} joined personal room ${roomId} (recipient ${recipientId}).`);

      reply({
        success: true,
        roomId,
        recipient: { id: users[0].id, name: users[0].name },
        message: `Connected to a private chat with ${users[0].name}.`
      });
    } catch (error) {
      console.error("join_room error:", error);
      reply({ success: false, message: "Unable to join the personal chat room." });
    }
  });

  // The client emits new_message; the server validates, stores, and relays it
  // only to the two participants' private room.
  socket.on("new_message", async (payload = {}, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const senderId = Number(socket.data.user.id);
      const recipientId = Number(payload.recipientId);
      const message = typeof payload.message === "string" ? payload.message.trim() : "";

      if (!socket.data.personalRoom ||
          recipientId !== Number(socket.data.personalRecipientId)) {
        return reply({ success: false, message: "Join the recipient's personal room first." });
      }
      if (!message) {
        return reply({ success: false, message: "Message cannot be empty." });
      }
      if (message.length > 2000) {
        return reply({ success: false, message: "Message must be 2000 characters or fewer." });
      }

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
         WHERE pm.id = ?`,
        [result.insertId]
      );

      const savedMessage = rows[0];
      // Private messages are sent only to sockets in this two-user room.
      io.to(socket.data.personalRoom).emit("new_message", savedMessage);
      console.log(`Private message ${savedMessage.id} delivered to room ${socket.data.personalRoom}.`);
      reply({ success: true, data: savedMessage });
    }  catch (error) {
  console.error("new_message error:", error);
  reply({ success: false, message: "Unable to send the personal message." });
}
  });
};
