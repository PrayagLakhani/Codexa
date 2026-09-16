# Codexa

A real-time collaborative code editor — create a private room, share the room code, and pair-program together live. Built with an in-browser editor, conflict-free live sync, in-room chat, and one-click code execution.

## Features

- **Authentication** — JWT-based authentication with bcrypt password hashing
- **Live collaborative editing** — multiple people can edit the same file simultaneously, with concurrent changes synchronized using CRDT-based collaboration (Yjs)
- **Room-based sessions** — create a password-protected room, get a shareable room code, invite others to join
- **Monaco-powered editor** — the same editor engine behind VS Code, with syntax highlighting and multi-language support
- **In-room chat** — talk with collaborators without leaving the workspace
- **File management** — create, edit, and delete files within a room, persisted to the database
- **Code execution** — submit code from the workspace and view execution results, powered by Judge0 via the backend
- **Live presence** — see who's currently online in your room

## Tech Stack

**Frontend**
- React 19
- Monaco Editor (`@monaco-editor/react`)
- Yjs + y-websocket + y-monaco — real-time conflict-free text sync
- Socket.IO client — chat, presence, file events
- React Router

**Backend**
- Node.js + Express
- Socket.IO — chat, presence, file-tree events
- `ws` + `@y/websocket-server` — WebSocket layer dedicated to Yjs collaborative sync
- MongoDB (native driver) — users, rooms, files, chat history
- JWT + bcrypt — authentication

**External services**
- [Judge0](https://judge0.com/) (via RapidAPI) — sandboxed code execution

## Architecture

Codexa runs two real-time systems side by side, each solving a different problem:

- **Yjs / WebSocket** handles collaborative text synchronization and conflict resolution inside the editor.
- **Socket.IO** handles event-based features such as presence, chat, and file-tree changes.

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
git clone https://github.com/PrayagLakhani/Codexa.git
cd Codexa
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
OPENROUTER_API_KEY=your-openrouter-key
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
REACT_APP_CODE_EXECUTION_ENABLED=false
```

> The AI-assistant panel uses `OPENROUTER_API_KEY` from `backend/.env`. The request is handled by the backend so the API key is not bundled into the public frontend.

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

### A note on Run Code

The "Run Code" feature depends on Judge0 via RapidAPI, which is a low-cost paid API (no meaningful free tier as of writing). It's disabled by default via the `REACT_APP_CODE_EXECUTION_ENABLED` flag, since self-hosting Judge0 isn't viable for a public deployment. To enable it:

1. Subscribe to [Judge0 CE](https://rapidapi.com/judge0-official/api/judge0-ce) on RapidAPI (a few requests cost fractions of a cent)
2. Set `RAPIDAPI_KEY` in `backend/.env`
3. Set `REACT_APP_CODE_EXECUTION_ENABLED=true` in `frontend/.env`

## Roadmap / Possible Improvements
- Add per-room role permissions (currently all room members are equal peers)
- Add automated tests

## Acknowledgements

Built as a learning project, with open-source collaborative editor implementations used as architectural references while developing the application independently.

## License

MIT
