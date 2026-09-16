// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import "./login.css";
// // import dotenv from "dotenv";
// // dotenv.config();
// //const BASE_URL = process.env.REACT_APP_API_URL;

// const Login = () => {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const navigate = useNavigate();

//   const handleLogin = async (e) => {
//     e.preventDefault();

//     const response = await fetch("http://10.81.78.12:8000/login", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ username, password }),
//     });

//     if (response.status === 200) {
//       const data = await response.json();
//       localStorage.setItem("authToken", data.token);
//       localStorage.setItem("username", data.username);
//       localStorage.setItem("role", "student");
//       navigate("/");
//     } else {
//       alert("Login failed");
//     }
//   };

//   return (
//     <div className="login-page">
//       {/* Left Side: Form */}
//       <form className="login-left" onSubmit={handleLogin}>
//         <h1>Welcome Back!</h1>
//         <input
//           type="text"
//           className="login-input"
//           placeholder="Username"
//           value={username}
//           onChange={(e) => setUsername(e.target.value)}
//           required
//         />
//         <input
//           type="password"
//           className="login-input"
//           placeholder="Password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//         />
//         <button className="login-btn" type="submit">
//           LOGIN
//         </button>
//         <p className="signup-text">
//           New here?
//           <span className="signup-link" onClick={() => navigate("/signup")}>
//             Sign Up
//           </span>
//         </p>
//       </form>

//       {/* Right Side: Illustration */}
//       <div className="login-right">
//         <p className="logo">Codexa</p>
//         <img src="/dev-illustration.png" alt="Developer Illustration" />
//       </div>
//     </div>
//   );
// };

// export default Login;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
const BASE_URL = process.env.REACT_APP_API_URL;

const Login = () => {
  console.log("BASE_URL =", BASE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    const response = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("Login response data:", data);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", "student");
      navigate("/");
    } else {
      alert("Login failed");
    }
  };

  return (
    <div className="login-page">
      {/* Left Side: Form */}
      <form className="login-left" onSubmit={handleLogin}>
        <h1>Hey, Welcome Coder!</h1>
        <input
          type="text"
          className="login-input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="login-btn" type="submit">
          LOGIN
        </button>
        <p className="signup-text">
          New here?
          <span className="signup-link" onClick={() => navigate("/signup")}>
            Sign Up
          </span>
        </p>
      </form>

      {/* Right Side: Illustration */}
      <div className="login-right">
        {/* <p className="title">Codexa</p> */}
        <img src="/dev-illustration.png" alt="Developer Illustration" />
      </div>
    </div>
  );
};

export default Login;
