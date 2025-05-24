import React, { useState } from "react";
import Chat from "./Chat";
import "./App.css";

function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="App">
      {!showChat ? (
        // 🔹 Landing Page View
        <div className="landing">
          <div className="logo-wrapper">
            <div
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '100px',
                boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
                display: 'inline-block',
                marginBottom: '10px'
              }}
            >
              <img 
                src="/SanvadAI-LogoFinal.png" 
                alt="SanvadAI Logo" 
                className="animated-logo"
                style={{ width: "150px" }}
              />
            </div>
            <h1 className="logo">SanvadAI</h1>
            <p className="tagline">Decentralized Conversations. Secured by AI.</p>
            <button onClick={() => setShowChat(true)}>Enter App</button>
          </div>
        </div>
      ) : (
        // 🔹 Chat Component View
        <>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '100px',
            boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
            display: 'inline-block',
            marginBottom: '10px'
          }}>
            <img 
              src="/SanvadAI-LogoFinal.png" 
              alt="SanvadAI Logo" 
              style={{ width: '150px' }} 
            />
          </div>

          <h1 className="logo">SanvadAI</h1>
          <Chat />
        </>
      )}
    </div>
  );
}

export default App;
