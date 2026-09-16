import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import "./Home.css";
const BASE_URL = process.env.REACT_APP_API_URL;

const Home = () => {
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [repoName, setRepoName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [repos, setRepos] = useState([]);

  const [joinPassword, setJoinPassword] = useState("");

  useEffect(() => {
    fetch(`${BASE_URL}/api/repos`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("authToken"),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRepos(data.repos);
        }
      })
      .catch((err) => console.error("Error fetching repos:", err));
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE_URL}/api/repos/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("authToken"),
        },
        body: JSON.stringify({ repoName, roomPassword }),
      });
      const data = await res.json();
      if (data.success) {
        // Clear any previous repoCode
        localStorage.removeItem("joinedRepoCode");
        // Store the new repoCode
        localStorage.setItem("joinedRepoCode", data.repoCode);
        // Force a full page reload
        window.location.href = `/workspace/${data.repoCode}`;
      } else {
        alert("Error creating room: " + data.message);
      }
    } catch (err) {
      alert("Error creating room.");
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE_URL}/api/repos/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("authToken"),
        },
        body: JSON.stringify({ joinCode, joinPassword }),
      });
      const data = await res.json();
      if (data.success) {
        // Clear any previous repoCode
        localStorage.removeItem("joinedRepoCode");
        // Store the new repoCode
        localStorage.setItem("joinedRepoCode", data.repoCode);
        // Force a full page reload
        window.location.href = `/workspace/${data.repoCode}`;
      } else {
        alert("Error joining room: " + data.message);
      }
    } catch (err) {
      alert("Error joining room.");
    }
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="logo-icon">{"</>"}</div>
        <h1 className="home-title">Welcome to Codexa!</h1>
        <p className="home-subtitle">
          A real time collaborative code editor for aspiring developers.
        </p>
        <div className="home-buttons">
          <button
            className="primary-btn"
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
            }}
          >
            CREATE A ROOM
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
            }}
          >
            JOIN A ROOM
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateSubmit} className="home-form">
          <h2>Create a New Room</h2>
          <input
            type="text"
            placeholder="Repository Name"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Room Password"
            value={roomPassword}
            onChange={(e) => setRoomPassword(e.target.value)}
            required
          />
          <button className="primary-btn" type="submit">
            Create
          </button>
        </form>
      )}

      {showJoin && (
        <form onSubmit={handleJoinSubmit} className="home-form">
          <h2>Join a Room</h2>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Enter Room Password"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            required
          />
          <button className="primary-btn" type="submit">
            Join
          </button>
        </form>
      )}

      {repos.length > 0 && (
        <div className="repo-list">
          <h2>Your Repositories</h2>
          <ul>
            {repos.map((repo, idx) => (
              <li key={idx}>
                <strong>{repo.repoName}</strong> — Code: {repo.repoCode}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Home;
