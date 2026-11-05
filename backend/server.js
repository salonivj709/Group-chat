require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const db = require("./config/db");
const messageController = require("./controllers/messageController");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN ||
  "http://127.0.0.1:5500,http://localhost:5500")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header (e.g. curl/Postman).
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked this origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    return res.status(200).json({
      success: true,
      message: "Group Chat API, MySQL and Socket.IO server are connected."
    });
  } catch (error) {
    console.error("Health check error:", error);
    return res.status(500).json({
      success: false,
      message: "API is running, but MySQL is unavailable."
    });
  }
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error("Request error:", error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: "Internal server error." });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Authenticate every Socket.IO connection using the JWT returned by /api/auth/login.
// The client sends it as: io(SOCKET_URL, { auth: { token } }).
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token required."));
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from backend/.env");
      return next(new Error("Server authentication is not configured."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return next(new Error("Invalid authentication token."));
    }

    // Store the authenticated identity on Socket.IO's supported data object.
    socket.data.user = {
      id: decoded.id,
      email: decoded.email || null
    };

    return next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    return next(new Error("Invalid or expired token."));
  }
});

function broadcastMessage(message) {
  io.emit("new_message", message);
  console.log(
    `Broadcast message ${message.id} to ${io.engine.clientsCount} connected client(s).`
  );
}

app.set("broadcastMessage", broadcastMessage);

io.on("connection", socket => {
  console.log(`Authenticated Socket.IO client connected (user ${socket.data.user.id}).`);

  socket.emit("connection_status", {
    success: true,
    message: "Live chat connection established."
  });

  socket.on("send_message", async (payload, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};

    try {
      const savedMessage = await messageController.saveMessage(
        socket.data.user.id,
        payload && payload.message
      );

      broadcastMessage(savedMessage);
      reply({
        success: true,
        message: "Message sent successfully.",
        data: savedMessage
      });
    } catch (error) {
      console.error("Socket send_message error:", error);
      reply({
        success: false,
        message: error.status ? error.message : "Unable to send message."
      });
    }
  });

  socket.on("disconnect", reason => {
    console.log(`Socket disconnected (user ${socket.data.user.id}): ${reason}`);
  });
});

server.listen(PORT, () => {
  console.log(`Group Chat API running at http://127.0.0.1:${PORT}`);
  console.log(`Socket.IO server running at http://127.0.0.1:${PORT}`);
  console.log(`Allowed frontend origins: ${allowedOrigins.join(", ")}`);
});

let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\nShutting down server...");
  io.close(async () => {
    try {
      await db.end();
    } catch (error) {
      console.error("Error closing MySQL pool:", error);
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
