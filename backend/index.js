import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { Server } from "socket.io";
import http from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";

dotenv.config();

// Server Configuration
const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || "12345";
const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/codexa";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Create HTTP server
const server = http.createServer(app);

// --- attach Yjs WS handler to your existing HTTP server ---
const wss = new WebSocketServer({ server /* binds to 0.0.0.0 by default */ });
wss.on("connection", (conn, req) => {
  // the 3rd arg is optional; defaults to using req.url.slice(1) as room name
  setupWSConnection(conn, req /*, { gc: true } */);
});

// MongoDB Setup
const client = new MongoClient(MONGODB_URI);
let db;

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

// CORS Configuration
const corsOptions = {
  origin: BASE_URL,
  methods: "GET, POST, PUT, DELETE",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.post("/api/ai/chat", async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OpenRouter API key is not configured",
      });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: "Messages must be an array",
      });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        // model: "deepseek/deepseek-r1",
        model : "openrouter/free",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "OpenRouter error:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to get AI response",
      error: error.response?.data || error.message,
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res
      .status(401)
      .json({ success: false, message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "Token not provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(403)
        .json({ success: false, message: "Invalid token", error: err });
    req.username = decoded.username;
    next();
  });
}

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: BASE_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Active users tracking
const usersInRoom = {};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("leave-room", (repoCode) => {
    if (usersInRoom[repoCode]) {
      usersInRoom[repoCode] = usersInRoom[repoCode].filter(
        (user) => user.id !== socket.id
      );
      io.to(repoCode).emit("update-users", usersInRoom[repoCode]);
      socket.leave(repoCode);
      console.log(`User ${socket.id} left room ${repoCode}`);
    }
  });

  socket.on("disconnect", () => {
    for (const room in usersInRoom) {
      usersInRoom[room] = usersInRoom[room].filter(
        (user) => user.id !== socket.id
      );
      io.to(room).emit("update-users", usersInRoom[room]);
    }
    console.log("User disconnected", socket.id);
  });

  // Handle room joining
  socket.on("join-room", async (repoCode, username) => {
    socket.join(repoCode);

    if (!usersInRoom[repoCode]) {
      usersInRoom[repoCode] = [];
    }

    // Remove any entry with the same username first
    usersInRoom[repoCode] = usersInRoom[repoCode].filter(
      (user) => user.name !== username
    );

    // Then add the new one
    usersInRoom[repoCode].push({ id: socket.id, name: username });

    // Fetch and send existing files
    try {
      const filesCollection = db.collection("files");
      console.log(`Fetching files for repo ${repoCode} for user ${username}`);

      const existingFiles = await filesCollection
        .find({ repoCode })
        .project({ _id: 0, filename: 1, content: 1 })
        .toArray();

      console.log(`Found ${existingFiles.length} files for repo ${repoCode}`);

      socket.emit(
        "initial-files",
        existingFiles.map((f) => ({
          path: f.filename,
          content: f.content,
        }))
      );

      // Load chat history
      const chatCollection = db.collection("chat_messages");
      const messages = await chatCollection
        .find({ repoCode })
        .sort({ timestamp: 1 })
        .limit(50)
        .toArray();

      socket.emit(
        "chat-history",
        messages.map((msg) => ({
          username: msg.username,
          message: msg.message,
          timestamp: msg.timestamp,
        }))
      );

      io.to(repoCode).emit("update-users", usersInRoom[repoCode]);
      console.log(`User ${socket.id} (${username}) joined room ${repoCode}`);
    } catch (error) {
      console.error(`Error fetching data for repo ${repoCode}:`, error);
    }
  });

  // AFTER
  socket.on(
    "file-created",
    async ({ repoCode, file, content: initialContent }) => {
      const filesCollection = db.collection("files");

      // Figure out the filename…
      const filename =
        typeof file === "string" ? file : file.path || file.name || "";

      // And take the content you actually passed in
      const content =
        typeof file === "object" && file.content != null
          ? file.content
          : initialContent;

      if (!filename) {
        console.error("Invalid file format:", file);
        return;
      }

      await filesCollection.updateOne(
        { repoCode, filename },
        { $set: { content } },
        { upsert: true }
      );

      io.to(repoCode).emit("file-created", {
        path: filename,
        content,
      });
    }
  );

  // Handle code changes
  socket.on("code-change", async ({ repoCode, filename, code }) => {
    const filesCollection = db.collection("files");

    await filesCollection.updateOne(
      { repoCode, filename },
      { $set: { content: code } },
      { upsert: true }
    );

    socket.to(repoCode).emit("code-update", { filename, code });
  });

  // Handle file deletion
  socket.on("file-deleted", async ({ repoCode, filePath }) => {
    const filesCollection = db.collection("files");

    console.log(`Deleting file ${filePath} from repo ${repoCode}`);

    try {
      const result = await filesCollection.deleteOne({
        repoCode,
        filename: filePath,
      });

      if (result.deletedCount > 0) {
        io.to(repoCode).emit("file-deleted", { filePath });
        console.log(`File ${filePath} deleted and broadcast to all users`);
      } else {
        console.log(`File ${filePath} not found in database`);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  });

  // Handle chat messages
  socket.on("send-message", async ({ repoCode, message, username }) => {
    // If username is not provided, try to find it in the active users list
    if (!username) {
      const user = usersInRoom[repoCode]?.find((user) => user.id === socket.id);
      username = user?.name || "Anonymous";
    }

    if (!repoCode || !message.trim()) return;

    try {
      // Create chat message object
      const chatMessage = {
        repoCode,
        username,
        message: message.trim(),
        timestamp: new Date(),
      };

      // Store in database
      await db.collection("chat_messages").insertOne(chatMessage);

      // Broadcast to all clients in the room
      io.to(repoCode).emit("new-message", {
        username: chatMessage.username,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
      });

      console.log(`Chat in ${repoCode} from ${username}: ${message}`);
    } catch (err) {
      console.error("Error saving chat message:", err);
      socket.emit("chat-error", { error: "Failed to save message" });
    }
  });

  // Save document content periodically
  socket.on("save-document", async ({ repoCode, filename, content }) => {
    try {
      const db = client.db("Jee");
      const filesCollection = db.collection("files");

      await filesCollection.updateOne(
        { repoCode, filename },
        { $set: { content } },
        { upsert: true }
      );

      console.log(`Document saved: ${repoCode}/${filename}`);
      socket.emit("document-saved", { filename });
    } catch (error) {
      console.error("Error saving document:", error);
      socket.emit("save-error", { filename, error: error.message });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    for (const room in usersInRoom) {
      usersInRoom[room] = usersInRoom[room].filter(
        (user) => user.id !== socket.id
      );
      io.to(room).emit("update-users", usersInRoom[room]);
    }
    console.log("User disconnected", socket.id);
  });
});

// API Routes
app.get("/", (req, res) => {
  res.status(200).send("Welcome to the root URL of Codexa Server");
});

app.get("/test", (req, res) => {
  console.log("Test route hit");
  res.status(200).json({ message: "Server is working" });
});

// User Authentication Routes
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Username and password are required" });
  }

  try {
    const usersCollection = db.collection("users");
    const userExists = await usersCollection.findOne({ username });

    if (userExists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ username, password: hashedPassword });

    res
      .status(200)
      .json({ success: true, message: "User created successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Username and password are required" });
  }

  try {
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect password" });
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Repository Routes
app.post("/api/repos/create", authenticateToken, async (req, res) => {
  const { repoName, roomPassword } = req.body;

  if (!repoName || !roomPassword) {
    return res.status(400).json({
      success: false,
      message: "Repository name and password required",
    });
  }

  try {
    const reposCollection = db.collection("repos");
    const hashedRoomPassword = await bcrypt.hash(roomPassword, 10);
    const repoCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newRepo = {
      repoName,
      roomPassword: hashedRoomPassword,
      repoCode,
      createdBy: req.username,
      createdAt: new Date(),
    };

    await reposCollection.insertOne(newRepo);

    res.status(200).json({
      success: true,
      message: "Repository created successfully",
      repoName,
      repoCode,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

app.get("/api/repos", authenticateToken, async (req, res) => {
  try {
    const reposCollection = db.collection("repos");
    const repos = await reposCollection
      .find({ createdBy: req.username })
      .toArray();

    res.status(200).json({ success: true, repos });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

app.post("/api/repos/join", authenticateToken, async (req, res) => {
  let { joinCode, joinPassword } = req.body;
  console.log("🕵️ join attempt:", `"${joinCode}"`, `"${joinPassword}"`);
  // trim out any accidental spaces
  joinCode = joinCode.trim();
  joinPassword = joinPassword.trim();

  if (!joinCode || !joinPassword) {
    return res.status(400).json({
      success: false,
      message: "Join code and password are required",
    });
  }

  const reposCollection = db.collection("repos");
  const repo = await reposCollection.findOne({ repoCode: joinCode });
  console.log("🕵️ db lookup result:", repo);

  if (!repo) {
    return res
      .status(400)
      .json({ success: false, message: "Repository not found" });
  }

  const match = await bcrypt.compare(joinPassword, repo.roomPassword);
  if (!match) {
    return res
      .status(401)
      .json({ success: false, message: "Incorrect room password" });
  }

  return res.status(200).json({
    success: true,
    repoName: repo.repoName,
    repoCode: repo.repoCode,
  });
});

// File Routes
app.get("/api/repos/:repoCode/files", authenticateToken, async (req, res) => {
  const { repoCode } = req.params;

  try {
    const filesCollection = db.collection("files");
    const files = await filesCollection
      .find({ repoCode })
      .project({ _id: 0, filename: 1, content: 1 })
      .toArray();

    res.status(200).json({ success: true, files });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch files",
      error: error.message,
    });
  }
});

app.put("/api/files/:repoCode", authenticateToken, async (req, res) => {
  const { repoCode } = req.params;
  const { filename, content } = req.body;

  if (!filename) {
    return res
      .status(400)
      .json({ success: false, message: "Filename is required" });
  }

  try {
    const filesCollection = db.collection("files");
    await filesCollection.updateOne(
      { repoCode, filename },
      { $set: { content } },
      { upsert: true }
    );

    res.status(200).json({ success: true, message: "File saved successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save file",
      error: error.message,
    });
  }
});

app.get("/api/files/:repoCode", authenticateToken, async (req, res) => {
  const { repoCode } = req.params;

  try {
    const filesCollection = db.collection("files");
    const fileDocuments = await filesCollection
      .find({ repoCode })
      .project({ _id: 0, filename: 1, content: 1 })
      .toArray();

    const files = {};
    fileDocuments.forEach((file) => {
      files[file.filename] = file.content;
    });

    res.status(200).json({ success: true, files });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch files",
      error: error.message,
    });
  }
});

app.delete("/api/files/:repoCode", authenticateToken, async (req, res) => {
  const { repoCode } = req.params;
  const { filename } = req.body;

  if (!filename) {
    return res
      .status(400)
      .json({ success: false, message: "Filename is required" });
  }

  console.log(`API request to delete file ${filename} from repo ${repoCode}`);

  try {
    const filesCollection = db.collection("files");
    const result = await filesCollection.deleteOne({ repoCode, filename });

    if (result.deletedCount > 0) {
      console.log(`File ${filename} deleted via API`);

      // Also notify all users about the deletion via socket
      io.to(repoCode).emit("file-deleted", { filePath: filename });

      res
        .status(200)
        .json({ success: true, message: "File deleted successfully" });
    } else {
      console.log(`File ${filename} not found when trying to delete via API`);
      res.status(404).json({ success: false, message: "File not found" });
    }
  } catch (error) {
    console.error("Error deleting file via API:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
});

// Change repository password
app.put(
  "/api/repos/:repoCode/password",
  authenticateToken,
  async (req, res) => {
    const { repoCode } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both current and new password are required",
      });
    }

    try {
      const repos = db.collection("repos");
      const repo = await repos.findOne({ repoCode });
      if (!repo) {
        return res
          .status(404)
          .json({ success: false, message: "Repository not found" });
      }
      // only creator can change it
      if (repo.createdBy !== req.username) {
        return res
          .status(403)
          .json({ success: false, message: "Not authorized" });
      }

      // verify current password
      const match = await bcrypt.compare(currentPassword, repo.roomPassword);
      if (!match) {
        return res
          .status(400)
          .json({ success: false, message: "Current password is incorrect" });
      }

      // hash & update
      const hashed = await bcrypt.hash(newPassword, 10);
      await repos.updateOne({ repoCode }, { $set: { roomPassword: hashed } });

      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (err) {
      console.error("Error changing repo password:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET a single repository by code
app.get("/api/repos/:repoCode", authenticateToken, async (req, res) => {
  const { repoCode } = req.params;
  try {
    const reposCollection = db.collection("repos");
    const repo = await reposCollection.findOne({ repoCode });
    if (!repo) {
      return res
        .status(404)
        .json({ success: false, message: "Repository not found" });
    }
    // Return only the fields the client needs
    return res.json({
      success: true,
      repository: {
        name: repo.repoName,
        repoCode: repo.repoCode,
      },
    });
  } catch (err) {
    console.error("Error fetching repo:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Chat Routes
app.get("/api/chat/:repoCode", authenticateToken, async (req, res) => {
  try {
    const { repoCode } = req.params;

    const chatCollection = db.collection("chat_messages");
    const messages = await chatCollection
      .find({ repoCode })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Code Execution Route
app.post("/api/run-code", authenticateToken, async (req, res) => {
  const { code, language, stdin } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      success: false,
      message: "Code and language are required",
    });
  }

  const languageMap = {
    python: 71,
    javascript: 63,
    cpp: 54,
    java: 62,
  };

  const languageId = languageMap[language];
  if (!languageId) {
    return res.status(400).json({
      success: false,
      message: "Unsupported language",
    });
  }

  try {
    // Submit code to Judge0 API
    const submissionResponse = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
      {
        language_id: languageId,
        source_code: code,
        stdin: stdin || "",
      },
      {
        headers: {
          "content-type": "application/json",
          "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const result = submissionResponse.data;

    if (result.stderr) {
      return res.status(400).json({
        success: false,
        message: "Runtime Error",
        error: result.stderr,
      });
    }

    if (result.compile_output) {
      return res.status(400).json({
        success: false,
        message: "Compilation Error",
        error: result.compile_output,
      });
    }

    return res.status(200).json({
      success: true,
      output: result.stdout,
    });
  } catch (error) {
    console.error("Execution error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Something went wrong",
      error: error.message,
    });
  }
});

// Start the server
async function startServer() {
  await connectToDatabase();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
