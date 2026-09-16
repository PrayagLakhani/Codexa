import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import debounce from "lodash.debounce";
import "./workspace.css";
import { useNavigate } from "react-router-dom"; // Add this import
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const BASE_URL = process.env.REACT_APP_API_URL;
const CODE_EXECUTION_ENABLED = process.env.REACT_APP_CODE_EXECUTION_ENABLED === "true";
const socket = io(process.env.REACT_APP_API_URL, {
  withCredentials: true,
});

const defaultCodeTemplates = {
  // javascript: 'console.log("Hello from JS!");',
  // python: 'print("Hello from Python!")',
  // cpp: '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}',
  // html: "<!DOCTYPE html>\n<html>\n<head><title>New Page</title></head>\n<body>\n  <h1>Hello HTML</h1>\n</body>\n</html>",
  javascript: "",
  python: "",
  cpp: "",
  html: "",
};

const repoCode = localStorage.getItem("joinedRepoCode");

const Workspace = () => {
  const navigate = useNavigate(); // Add this for navigation
  const [activePanel, setActivePanel] = useState("files");
  const [activeFile, setActiveFile] = useState("index.html");
  const [showModal, setShowModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [stdin, setStdin] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [newFileLang, setNewFileLang] = useState("javascript");
  const [chatInput, setChatInput] = useState("");
  const [files, setFiles] = useState({});
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [editingPwd, setEditingPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState(null);
  const editorRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const bindingsRef = useRef({});
  const [documentSaved, setDocumentSaved] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHoveringCopy, setIsHoveringCopy] = useState(false);

  // Add repository information state
  const [repoInfo, setRepoInfo] = useState({
    name: "Loading...",
    code: repoCode || "N/A",
    password: "********", // For security, we don't show the actual password
  });

  const getLanguageFromFilename = (filename) => {
    if (filename.endsWith(".js")) return "javascript";
    if (filename.endsWith(".css")) return "css";
    if (filename.endsWith(".html")) return "html";
    if (filename.endsWith(".py")) return "python";
    if (filename.endsWith(".cpp")) return "cpp";
    return "plaintext";
  };

  // Save file content periodically
  const saveFileContent = useRef(
    debounce((filename, content) => {
      if (!repoCode || !filename) return;

      socket.emit("save-document", {
        repoCode,
        filename,
        content,
      });

      setDocumentSaved((prev) => ({
        ...prev,
        [filename]: true,
      }));

      setTimeout(() => {
        setDocumentSaved((prev) => ({
          ...prev,
          [filename]: false,
        }));
      }, 2000);
    }, 2000)
  ).current;

  const newlyCreatedRef = useRef({});

  const handleCreateFile = () => {
    if (!newFileName) return;

    let extension = "";
    if (newFileLang === "javascript") extension = ".js";
    else if (newFileLang === "python") extension = ".py";
    else if (newFileLang === "cpp") extension = ".cpp";
    else if (newFileLang === "html") extension = ".html";

    const fullFileName = newFileName + extension;
    newlyCreatedRef.current[fullFileName] = true;

    const content = defaultCodeTemplates[newFileLang] || "";

    // Update local state
    const updated = { ...files, [fullFileName]: content };
    setFiles(updated);
    setActiveFile(fullFileName);
    setShowModal(false);
    setNewFileName("");
    setNewFileLang("javascript");

    // Emit socket event to notify other users
    socket.emit("file-created", {
      repoCode,
      file: fullFileName,
      content: content,
    });

    // Save to DB via API
    const token = localStorage.getItem("authToken");
    fetch(`${BASE_URL}/api/files/${repoCode}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename: fullFileName,
        content,
      }),
    }).catch((err) => console.error("Error saving file:", err));
  };

  const [chatMessages, setChatMessages] = useState([
    {
      username: "System",
      message: "Welcome to the chat!",
      timestamp: new Date(),
    },
  ]);

  const handleSendMessage = () => {
    if (!chatInput) {
      console.error("Chat input is undefined or null.");
      return;
    }

    const trimmed = chatInput.trim();
    if (trimmed) {
      try {
        const username = localStorage.getItem("username") || "Anonymous";

        socket.emit("send-message", {
          repoCode,
          message: trimmed,
          username,
        });

        setChatInput("");
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPwd || !newPwd) {
      setPwdMsg("Please fill both fields");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("New passwords do not match");
      return;
    }

    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(
        `${BASE_URL}/api/repos/${repoInfo.code}/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: currentPwd,
            newPassword: newPwd,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setPwdMsg("Password changed!");
        // reset form
        setEditingPwd(false);
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
      } else {
        setPwdMsg(data.message || "Failed to update");
      }
    } catch (err) {
      console.error(err);
      setPwdMsg("Server error");
    }
  };

  // Add function to handle leaving the room
  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this workspace?")) {
      socket.emit("leave-room", repoCode);
      localStorage.removeItem("joinedRepoCode");
      navigate("/"); // Navigate to home page
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile) return;

    // Get current content directly from the editor
    const content = editorRef.current.getValue();

    // Save to server
    saveFileContent(activeFile, content);
  };

  const handleRunCode = async () => {
    const language = getLanguageFromFilename(activeFile);
    const supportedLanguages = ["python", "javascript", "cpp"];

    if (!supportedLanguages.includes(language)) {
      setOutput("⚠️ This file type is not supported for execution.");
      return;
    }

    setIsRunning(true);
    setOutput("⏳ Running...");

    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch(`${BASE_URL}/api/run-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: files[activeFile],
          language: language,
          stdin: stdin,
        }),
      });

      const result = await res.json();

      if (result.stderr) {
        setOutput(`❌ Error:\n${result.stderr}`);
      } else if (result.compile_output) {
        setOutput(`⚙️ Compilation Error:\n${result.compile_output}`);
      } else if (result.output) {
        setOutput(`✅ Output:\n${result.output}`);
      } else {
        setOutput(`❌ Unknown Error:\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (err) {
      setOutput("❗ Failed to execute code.");
      console.error("Execution error:", err);
    }

    setIsRunning(false);
  };

  const handleDeleteFile = (filename) => {
    // if (!files[filename]) {
    //   console.warn(
    //     `Tried to delete a file that doesn't exist locally: ${filename}`
    //   );
    //   return;
    // }

    if (!(filename in files)) {
      console.warn(
        `Tried to delete a file that doesn't exist locally: ${filename}`
      );
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      // Cleanup Yjs if this file is active
      if (activeFile === filename) {
        try {
          cleanupRef.current();
        } catch (err) {
          console.warn("Cleanup failed:", err);
        }
      }

      // Immediately prevent editor from trying to re-render the deleted file
      setActiveFile((prev) => (prev === filename ? null : prev));

      // Update local state
      setFiles((prevFiles) => {
        const updated = { ...prevFiles };
        delete updated[filename];
        return updated;
      });

      // Emit socket event
      socket.emit("file-deleted", {
        repoCode,
        filePath: filename,
      });

      // Delete via API
      const token = localStorage.getItem("authToken");
      fetch(`${BASE_URL}/api/files/${repoCode}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename }),
      })
        .then((response) => {
          if (!response.ok) {
            console.error("Failed to delete file via API", response.status);
          }
        })
        .catch((err) => console.error("Error deleting file via API:", err));
    }
  };

  const capitalizeWords = (str) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const userMessage = { role: "user", content: aiInput.trim() };
    // setAiMessages("");
    // setAiMessages((prev) => [...prev, userMessage]);
    // setAiInput("");
    setLoadingAI(true);

    try {
      // const response = await fetch(
      //   "https://openrouter.ai/api/v1/chat/completions",
      //   {
      //     method: "POST",
      //     headers: {
      //       Authorization: `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,

      //       // `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({
      //       model: "deepseek/deepseek-r1:free", // Replace with your chosen model
      //       messages: [...aiMessages, userMessage],
      //     }),
      //   }
      // );
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...aiMessages, userMessage],
          }),
        }
      );

      const data = await response.json();
      if (data && data.choices && data.choices[0]) {
        const aiResponse = {
          role: "assistant",
          content: data.choices[0].message.content,
        };
        setAiMessages((prev) => [...prev, aiResponse]);
        setAiInput("");
      } else {
        console.error("Unexpected API response:", data);
      }
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const MarkdownRenderer = ({ content }) => {
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");

            const handleCopy = () => {
              try {
                const text = String(children);
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch (err) {
                console.error("Copy failed:", err);
              }
            };

            return !inline && match ? (
              <div
                className="code-block-wrapper"
                style={{ position: "relative" }}
                onMouseEnter={() => setIsHoveringCopy(true)}
                onMouseLeave={() => setIsHoveringCopy(false)}
              >
                <button
                  onClick={handleCopy}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "#333",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: "10 px",
                    zIndex: 10,
                    opacity: isHoveringCopy ? 1 : 0,
                    transition: "opacity 0.2s ease-in-out",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <SyntaxHighlighter
                  style={atomDark}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const renderSidebarContent = () => {
    if (activePanel === "settings") {
      return (
        <div className="settings-panel">
          <h3>Repository Settings</h3>
          <div className="repo-info">
            <div className="info-row">
              <label>Repository Name:</label>
              <span>{repoInfo.name}</span>
            </div>
            <div className="info-row">
              <label>Repository Code:</label>
              <span>{repoInfo.code}</span>
            </div>
            <div className="info-row">
              <label>Password:</label>
              {editingPwd ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    className="password-input"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="password-input"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="password-input"
                  />
                  {pwdMsg && <div className="pwd-msg">{pwdMsg}</div>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={handlePasswordChange}>Save</button>
                    <button
                      onClick={() => {
                        setEditingPwd(false);
                        setPwdMsg(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingPwd(true)}>
                  Change Password
                </button>
              )}
            </div>
          </div>
          <div className="settings-actions">
            <button className="leave-btn" onClick={handleLeaveRoom}>
              Leave Repository
            </button>
          </div>
        </div>
      );
    }

    if (activePanel === "chat") {
      return (
        <div className="chat-box">
          <h3>Team Chat</h3>
          <div className="chat-messages">
            {chatMessages.map((msg, idx) => {
              const currentUser =
                localStorage.getItem("username") || "Anonymous";
              const isOwn = msg.username === currentUser;
              return (
                <div key={idx} className={`chat-message${isOwn ? " own" : ""}`}>
                  <div className="chat-content">
                    <span className="chat-username">
                      {isOwn
                        ? "You"
                        : capitalizeWords(msg.username) || "Anonymous"}
                    </span>

                    <span className="chat-text">{msg.message}</span>
                    {msg.timestamp && (
                      <span className="chat-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              placeholder="Type a message..."
              className="chat-message-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              className="chat-send-btn"
              title="Send"
              onClick={handleSendMessage}
            >
              ➤
            </button>
          </div>
        </div>
      );
    }

    if (activePanel === "output") {
      return (
        <div>
          <div className="output-panel">
            <div>
              <h3>Standard Input (stdin)</h3>
              <textarea
                className="stdin-input"
                rows={4}
                placeholder="Enter input for the program..."
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <h3>Execution Output</h3>
            <pre className="code-output" style={{ whiteSpace: "pre-wrap" }}>
              {output || "No output yet."}
            </pre>
          </div>
          {/* <div className="run-controls">
            <button onClick={handleRunCode} disabled={isRunning}>
              {isRunning ? "Running..." : "Run Code"}
            </button>
          </div> */}
          <div className="run-controls">
            {CODE_EXECUTION_ENABLED ? (
              <button onClick={handleRunCode} disabled={isRunning}>
                {isRunning ? "Running..." : "Run Code"}
              </button>
            ) : (
              <div className="run-disabled-note">
                <button disabled title="Code execution is currently unavailable">
                  Run Code
                </button>
                <p>
                  Code execution runs through a paid third-party sandbox and
                  isn't enabled on this deployment right now.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activePanel === "users") {
      return (
        <div className="users-panel">
          <h3>Active Users</h3>
          <ul className="user-list">
            {activeUsers.map((user, idx) => (
              <li key={idx}>👤 {user.name}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (activePanel === "ai-assistance") {
      return (
        <div className="ai-assistance-panel">
          <h3>AI Assistance 🤖</h3>
          <div className="ai-chatbox">
            <div className="ai-messages">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`ai-message ${
                    msg.role === "user" ? "user" : "assistant"
                  }`}
                >
                  <MarkdownRenderer content={msg.content} />
                </div>
              ))}
              {loadingAI && <div className="ai-loading">Loading...</div>}
            </div>
            <textarea
              className="ai-input"
              placeholder="Ask the AI something..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleAiSubmit(e)
              }
            />
            <button className="ai-submit-btn" onClick={handleAiSubmit}>
              Send
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h3>Your Files</h3>
        <button className="chat-send-btn" onClick={() => setShowModal(true)}>
          ➕ Add File
        </button>
        <ul className="file-list">
          {Object.keys(files).map((filename) => (
            <li
              key={filename}
              className={activeFile === filename ? "active-file" : ""}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                onClick={() => setActiveFile(filename)}
                style={{ flex: 1, cursor: "pointer" }}
              >
                {filename}
              </span>
              <button
                onClick={() => handleDeleteFile(filename)}
                title="Delete File"
                style={{
                  background: "none",
                  border: "none",
                  color: "#f55",
                  cursor: "pointer",
                  fontSize: "14px",
                  marginLeft: "8px",
                }}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // 1) a ref to call the latest cleanup
  const cleanupRef = useRef(() => {});
  // 2) remember which file we last mounted
  const lastFileRef = useRef(null);

  const setupEditorWithYjs = (editor, filename) => {
    // only tear down if we’re switching filenames
    if (lastFileRef.current !== filename) {
      //cleanupRef.current();
      try {
        cleanupRef.current();
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }

      lastFileRef.current = filename;
    }

    // bail out if missing
    if (!editor || !filename || !repoCode) {
      return;
    }

    // ─── CREATE FRESH YDOC + PROVIDER + BINDING ────────────────────────────
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const WS_URL =
      (process.env.REACT_APP_YJS_WS_URL || BASE_URL).replace(/^http/, "ws") +
      "/yjs";

    const roomName = `${repoCode}-${filename}`;
    const provider = new WebsocketProvider(WS_URL, roomName, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText(filename);
    // Inject the boilerplate only if Yjs text is empty
    if (newlyCreatedRef.current[filename] && files[filename]) {
      ytext.insert(0, files[filename]); // only insert once
      delete newlyCreatedRef.current[filename];
    }

    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );
    bindingsRef.current[filename] = binding;

    // ─── WATCH FOR CONTENT CHANGES ─────────────────────────────────────────
    const handleContentChange = () => {
      const newContent = editor.getValue();
      if (files[filename] !== newContent) {
        setFiles((prev) => ({ ...prev, [filename]: newContent }));
        saveFileContent(filename, newContent);
      }
    };

    const disposable = editor.onDidChangeModelContent(handleContentChange);

    // optional status logging
    provider.on("status", ({ status }) => {
      console.log(`Yjs ${status} for ${filename}`);
    });

    const cleanup = () => {
      try {
        disposable.dispose();

        if (bindingsRef.current[filename]) {
          bindingsRef.current[filename].destroy();
          delete bindingsRef.current[filename];
        }

        provider?.destroy();
        ydoc?.destroy();
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }
    };

    cleanupRef.current = cleanup;
    return cleanup;
  };

  const currentRoomRef = useRef(null); // track the current joined room
  useEffect(() => {
    if (!repoCode) return;

    const username = localStorage.getItem("username") || "Guest";

    if (currentRoomRef.current && currentRoomRef.current !== repoCode) {
      socket.emit("leave-room", currentRoomRef.current);
    }
    const token = localStorage.getItem("authToken");

    // ----------

    // ... existing code ...

    // Chat-specific socket event listeners
    socket.on("new-message", (message) => {
      setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    //--------------

    currentRoomRef.current = repoCode;
    socket.emit("join-room", repoCode, username);

    //------------------o--------------------
    socket.on("chat-history", (messages) => {
      setChatMessages(messages);
    });

    socket.on("chat-error", ({ error }) => {
      console.error("Chat error:", error);
      // Optionally display an error to the user
    });

    // Fetch repository information

    fetch(`${BASE_URL}/api/repos/${repoCode}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.repository) {
          setRepoInfo({
            name: data.repository.name || "Unnamed Repository",
            code: repoCode,
            password: "********", // Keep password hidden
          });
        } else {
          console.error(
            "Failed to fetch repository info:",
            data.message || "Unknown error"
          );
          setRepoInfo((prev) => ({ ...prev, name: "Error loading name" })); // Fallback
        }
      })
      .catch((err) => {
        console.error("Error loading repository information:", err);
        setRepoInfo((prev) => ({ ...prev, name: "Error loading name" })); // Fallback
      });
    //------------------o--------------------

    // Load files from database on mount
    fetch(`${BASE_URL}/api/files/${repoCode}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.files) {
          setFiles(data.files); // Ensure all files are added to the state
          // Set active file to the first file if no active file is set
          if (!activeFile || !(activeFile in data.files)) {
            const fileKeys = Object.keys(data.files);
            if (fileKeys.length > 0) {
              setActiveFile(fileKeys[0]);
            }
          }
        }
      })
      .catch((err) => console.error("Error loading files:", err));

    socket.on("document-saved", ({ filename }) => {
      setDocumentSaved((prev) => ({
        ...prev,
        [filename]: true,
      }));

      setTimeout(() => {
        setDocumentSaved((prev) => ({
          ...prev,
          [filename]: false,
        }));
      }, 2000);
    });

    socket.on("file-created", (file) => {
      if (!file || !file.path) return;
      setFiles((prevFiles) => {
        if (prevFiles[file.path]) return prevFiles;
        return { ...prevFiles, [file.path]: file.content || "" };
      });
    });

    socket.on("file-deleted", ({ filePath }) => {
      console.log(`Received file-deleted event for ${filePath}`);

      setFiles((prevFiles) => {
        if (!prevFiles[filePath]) {
          console.log(
            `File ${filePath} not found in local state, nothing to delete`
          );
          return prevFiles;
        }

        console.log(`Removing file ${filePath} from local state`);
        const updated = { ...prevFiles };
        delete updated[filePath];

        // Update active file if needed
        if (activeFile === filePath) {
          const remaining = Object.keys(updated);
          setActiveFile(remaining.length ? remaining[0] : "");
        }

        return updated;
      });
    });

    socket.on("update-users", (users) => {
      setActiveUsers(users);
    });

    socket.on("initial-files", (filesArray) => {
      const filesObj = {};
      filesArray.forEach((file) => {
        filesObj[file.path] = file.content;
      });

      setFiles(filesObj);

      // Set active file to the first file if we have files
      if (Object.keys(filesObj).length > 0 && !activeFile) {
        setActiveFile(Object.keys(filesObj)[0]);
      }
    });

    return () => {
      socket.emit("leave-room", repoCode);
      //socket.off("code-update");
      socket.off("file-created");
      socket.off("file-deleted");
      socket.off("update-users");
      socket.off("initial-files");
      socket.emit("leave-room", repoCode);
      socket.off("new-message");
      socket.off("chat-history");
      socket.off("chat-error");

      try {
        cleanupRef.current();
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }

      // cleanupRef.current();
      // Clean up Yjs bindings
      Object.values(bindingsRef.current).forEach((binding) => {
        if (binding && binding.destroy) binding.destroy();
      });

      // Destroy provider
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, [navigate, activeFile]);

  return (
    <div className="workspace-container">
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New File</h3>
            <input
              type="text"
              placeholder="Enter file name (no extension)"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
            />
            <select
              value={newFileLang}
              onChange={(e) => setNewFileLang(e.target.value)}
            >
              <option value="javascript">JavaScript (.js)</option>
              <option value="python">Python (.py)</option>
              <option value="cpp">C++ (.cpp)</option>
            </select>
            <div style={{ marginTop: "10px" }}>
              <button onClick={handleCreateFile}>Create</button>
              <button onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="workspace-main">
        <div className="vertical-toolbar">
          <button title="Files" onClick={() => setActivePanel("files")}>
            📁
          </button>
          <button title="Chat" onClick={() => setActivePanel("chat")}>
            💬
          </button>
          <button title="Output" onClick={() => setActivePanel("output")}>
            📤
          </button>
          <button title="Active Users" onClick={() => setActivePanel("users")}>
            👥
          </button>
          <button
            title="AI Assistance"
            onClick={() => setActivePanel("ai-assistance")}
          >
            🤖
          </button>
          <button title="Settings" onClick={() => setActivePanel("settings")}>
            ⚙️
          </button>
        </div>

        <div className="file-sidebar">{renderSidebarContent()}</div>

        <div className="code-editor">
          <div className="editor-pane">
            {activeFile in files ? (
              <Editor
                key={activeFile}
                language={getLanguageFromFilename(activeFile)}
                value={files[activeFile] || ""}
                // onMount={(editor) => {
                //   setTimeout(() => setupEditorWithYjs(editor, activeFile), 50);
                // }}
                onMount={(editor) => {
                  if (editor.getModel()) {
                    setTimeout(
                      () => setupEditorWithYjs(editor, activeFile),
                      50
                    );
                  } else {
                    editor.onDidCreateModel(() =>
                      setupEditorWithYjs(editor, activeFile)
                    );
                  }
                }}
                theme="vs-dark"
                options={{
                  fontSize: 16,
                  minimap: { enabled: false },
                  fontFamily: "Courier New, monospace",
                  automaticLayout: true,
                }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888",
                  fontSize: "18px",
                  fontStyle: "italic",
                }}
              >
                Select or create a file to start editing...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
