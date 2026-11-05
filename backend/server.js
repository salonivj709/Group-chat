require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const db = require("./config/db");
const messageController = require("./controllers/messageController");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || true;

app.use(cors({ origin: frontendOrigin }));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      success: true,
      message: "Group Chat API, MySQL and Socket.IO server are connected."
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      message: "API is running, but MySQL is unavailable."
    });
  }
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found." }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"]
  }
});

// Verify the JWT during the Socket.IO handshake.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token || !process.env.JWT_SECRET) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return next(new Error("Invalid authentication token."));

    socket.user = decoded;
    return next();
  } catch (error) {
    return next(new Error("Invalid or expired token."));
  }
});

// All connected clients receive the saved message after the database insert succeeds.
function broadcastMessage(message) {
  io.emit("new_message", message);
  console.log(`Broadcast message ${message.id} to ${io.engine.clientsCount} connected client(s).`);
}

app.set("broadcastMessage", broadcastMessage);

io.on("connection", socket => {
  console.log(`Authenticated Socket.IO client connected (user ${socket.user.id}).`);

  socket.emit("connection_status", {
    success: true,
    message: "Live chat connection established."
  });

  // Client sends: socket.emit("send_message", { message }, acknowledgementCallback)
  socket.on("send_message", async (payload, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const savedMessage = await messageController.saveMessage(
        socket.user.id,
        payload && payload.message
      );

      broadcastMessage(savedMessage);
      reply({
        success: true,
        message: "Message sent successfully.",
        data: savedMessage
      });
    } catch (error) {
      reply({
        success: false,
        message: error.status ? error.message : "Unable to send message."
      });
    }
  });

  socket.on("disconnect", reason => {
    console.log(`Socket.IO client disconnected (user ${socket.user.id}): ${reason}`);
  });

  socket.on("error", error => {
    console.error("Socket.IO client error:", error.message);
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`Group Chat API running at http://localhost:${PORT}`);
  console.log(`Socket.IO server running at http://localhost:${PORT}`);
});

function shutdown() {
  io.close(async () => {
    try {
      await db.end();
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
