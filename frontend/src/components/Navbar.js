import React, { useState } from "react";
import Modal from "react-modal";
import "./Navbar.css";
import { Link, useLocation } from "react-router-dom";

const Navbar = (props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const role = localStorage.getItem("role");
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    window.location.href = "/login";
  };

  const hideLogoutPath =
    location.pathname === "/login" || location.pathname === "/signup";

  const hideNav =
    role === "workspace" || location.pathname.startsWith("/workspace");

  return (
    <div>
      <nav
        className="navbar navbar-expand-lg navbar-dark"
        style={{ backgroundColor: "#1e1e1e" }}
      >
        <div className="container-fluid">
          <div className="navbar-brand">Codexa</div>
          <div
            className="collapse navbar-collapse"
            id="navbarSupportedContent"
          >
            {!hideNav && !hideLogoutPath && (
              <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/" ? "active-link" : ""
                    }`}
                    aria-current="page"
                    to={role === "student" ? "/" : "/admin"}
                  >
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      location.pathname === "/aboutt" ? "active-link" : ""
                    }`}
                    to="/aboutt"
                  >
                    About
                  </Link>
                </li>
              </ul>
            )}
            {!hideLogoutPath && !hideNav && (
              <button
                className="login-btn"
                onClick={() => setIsModalOpen(true)}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="logout-modal"
        overlayClassName="logout-modal-overlay"
      >
        <h2>Are you sure you want to logout?</h2>
        <div className="modal-buttons">
          <button
            className="primary-btn"
            onClick={() => {
              handleLogout();
              setIsModalOpen(false);
            }}
          >
            Yes
          </button>
          <button
            className="secondary-btn"
            onClick={() => setIsModalOpen(false)}
          >
            No
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Navbar;
