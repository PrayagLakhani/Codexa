import React from "react";
import "./Aboutt.css";

const About = () => {
  return (
    <div className="about-page">
      <div className="about-container">
        <h1 className="about-title">About Codexa</h1>
        <p className="about-description">
          Codexa is a real-time collaborative code editor designed for aspiring developers, teams, and educators. 
          Our platform allows users to create, share, and collaborate on code seamlessly, making it the perfect tool 
          for pair programming, coding interviews, and team projects.
        </p>
        <h2 className="about-subtitle">Features</h2>
        <ul className="about-features">
          <li>👩‍💻 Real-time collaboration with multiple users.</li>
          <li>📂 Create and manage repositories for your projects.</li>
          <li>🔒 Secure rooms with password protection.</li>
          <li>🧠 AI assistance for code suggestions and debugging.</li>
          <li>🌐 Support for multiple programming languages.</li>
        </ul>
        <h2 className="about-subtitle">Have Suggestions or Feedback?</h2>
        <p className="about-description">
          We value your feedback and would love to hear your suggestions for improving Codexa. Feel free to explore our 
          repositories and contribute to the project:
        </p>
        <ul className="about-links">
          <li>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Project Repository
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default About;
