# Codexa

A real-time collaborative code editor — create a private room, share the room code, and pair-program together live. Built with an in-browser editor, conflict-free live sync, in-room chat, and one-click code execution.

## Features

- **Live collaborative editing** — multiple people can type in the same file simultaneously without overwriting each other's changes, powered by CRDT-based sync (Yjs)
- **Room-based sessions** — create a password-protected room, get a shareable room code, invite others to join
- **Monaco-powered editor** — the same editor engine behind VS Code, with syntax highlighting and multi-language support
- **In-room chat** — talk with collaborators without leaving the workspace
- **File management** — create, edit, and delete files within a room, persisted to the database
- **Code execution** — run code directly in the browser and see output, powered by Judge0
- **Live presence** — see who's currently online in your room

## Tech Stack

**Frontend**
- React 19
- Monaco Editor (`@monaco-editor/react`)
- Yjs + y-websocket + y-monaco — real-time conflict-free text sync
- Socket.IO client — chat, presence, file events
- React Router, Axios

**Backend**
- Node.js + Express
- Socket.IO — chat, presence, file-tree events
- `ws` + `y-websocket` server — dedicated WebSocket layer for live editor sync
- MongoDB (native driver) — users, rooms, files, chat history
- JWT + bcrypt — authentication

**External services**
- [Judge0](https://judge0.com/) (via RapidAPI) — sandboxed code execution

## Architecture

Codexa runs two real-time systems side by side, each solving a different problem:

- **Yjs / y-websocket** handles character-level text merging inside the editor, so simultaneous edits from multiple people never conflict.
- **Socket.IO** handles everything else that's event-based rather than continuous: presence, chat, and file-tree changes.

```text
User → Frontend (React) → REST API (auth, rooms, files) → MongoDB
                        ↘ Socket.IO (chat, presence, files)
                        ↘ Yjs / WebSocket (live editor sync)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB instance (local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- A [RapidAPI](https://rapidapi.com/) key subscribed to the Judge0 CE API (optional — only needed for the "Run Code" feature)

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/codexa.git
cd codexa
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `backend/.env` file:

```env
PORT=8000
JWT_SECRET=your-long-random-secret
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/codexa
RAPIDAPI_KEY=your-judge0-rapidapi-key
```

Start the server:

```bash
npm start
```

### 3. Frontend setup

```bash
cd frontend
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is currently needed due to a peer-dependency mismatch between React 19 and `@testing-library/react` (used only by the default CRA test file).

Create a `frontend/.env` file:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_YJS_WS_URL=ws://localhost:8000
REACT_APP_OPENROUTER_API_KEY=your-openrouter-key
```

> `REACT_APP_OPENROUTER_API_KEY` only powers the optional AI-assistant panel. **Note:** any `REACT_APP_*` variable is bundled into the public frontend build and is visible to anyone who inspects it — don't reuse a key you don't want exposed.

Start the app:

```bash
npm start
```

Visit **http://localhost:3000**, sign up, create a room, and start coding.

## Project Structure

```text
codexa/
├── backend/
│   ├── index.js       # Express + Socket.IO + Yjs WebSocket server
│   └── package.json
└── frontend/
    ├── public/
    └── src/
        ├── App.js
        └── components/
            ├── Home.js
            ├── login.js / signup.js
            ├── Navbar.js
            └── Workspace.js   # the collaborative editor
```

## Roadmap / Possible Improvements

- Move the AI-assistant API call server-side to avoid exposing the API key in the frontend bundle
- Add per-room role permissions (currently all room members are equal peers)
- Add automated tests

## Acknowledgements

Built as a learning project, using an existing open-source collaborative editor concept as an architectural reference, then rebuilt independently with its own codebase, structure, and improvements.

## License

MIT
