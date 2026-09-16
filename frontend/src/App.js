import Navbar from "./components/Navbar";
import { useEffect, useState } from "react";
import About from "./components/Aboutt";
import { Routes, Route, useNavigate } from "react-router-dom";
import { createContext } from "react";
import Login from "./components/login.js";
import SignUp from "./components/signup.js";
import Home from "./components/Home";
import Workspace from "./components/Workspace.js";

const userContext = createContext();
function App() {
  const [mode, setMode] = useState("light");
  const [namee, setNamee] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem("authToken"));
  const navigate = useNavigate();

  useEffect(() => {
    setAuthToken(localStorage.getItem("authToken")); // Get token from localStorage
    if (!authToken) {
      // If no token found, allow navigation to login or signup
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/signup"
      ) {
        navigate("/login"); // Redirect to login page if no token and not visiting login/signup
      }
    } else {
      // If token found, allow navigation to all pages
      setNamee(localStorage.getItem("username"));
      if (
        window.location.pathname === "/login" ||
        window.location.pathname === "/signup"
      ) {
        navigate("/"); // Redirect to home page if token is found and visiting login/signup
      }
    }
  }, [authToken, navigate]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "+" || event.key === "-" || event.key === "=")
      ) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const [text, setText] = useState("");

  return (
    <userContext.Provider
      value={{
        namee,
        setNamee,
        text,
        setText,
      }}
    >
      <div
        className="container-fluid"
        style={{
          width: "100vw", // Full width
          height: "100vh", // Full height
          marginTop: "20px", // Add margin from the top
          display: "flex",
          flexDirection: "column", // Ensure content fills the vertical space
          backgroundRepeat: "no-repeat", // Prevent tiling
          backgroundPosition: "center", // Center the image
          backgroundSize: "cover", // Ensure the whole image is visible
          position: "relative",
        }}
      >
        <Navbar title="Code Editor" mode={mode} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/aboutt" element={<About />} /> {/* Ensure this matches the Navbar link */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/workspace/:repoName" element={<Workspace />} />
        </Routes>
      </div>
    </userContext.Provider>
  );
}

export default App;
export { userContext };
