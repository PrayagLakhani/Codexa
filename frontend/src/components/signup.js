import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./signup.css";
const BASE_URL = process.env.REACT_APP_API_URL;

const SignUp = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const response = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.status === 200) {
      navigate("/login");
    } else {
      alert("Sign-up failed");
    }
  };

  return (
    <div className="signup-page">
      {/* Left Side: Form */}
      <form className="signup-left" onSubmit={handleSignUp}>
        <h1>Create Account</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit">SIGN UP</button>
        <p className="login-text">
          Already have an account?
          <span onClick={() => navigate("/login")}> Login</span>
        </p>
      </form>

      {/* Right Side: Illustration */}
      <div className="signup-right">
        <img src="/dev-illustration.png" alt="Developer Illustration" />
      </div>
    </div>
  );
};

export default SignUp;
