import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import CryptoJS from "crypto-js";
import * as nsfwjs from "nsfwjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

const KNOWN_MESSAGES = [
  { text: "Should I confirm the order?", response: "Yes, please confirm." },
  { text: "Can I confirm the appointment?", response: "Yes, go ahead and confirm it." },
  { text: "Coming for dinner?", response: "Yes, I’ll be there!" },
  { text: "Should I place the order?", response: "Yes, go ahead and place it." },
  { text: "Is the plan confirmed?", response: "Yes, the plan is confirmed." },
  { text: "Want to catch up later?", response: "Sure, let’s catch up!" },
  { text: "Are we still meeting today?", response: "Yes, meeting is still on." },
  { text: "Is the event still happening?", response: "Yes, it's happening as planned." },
  { text: "Shall I proceed?", response: "Yes, please proceed." },
  { text: "Do I need to book now?", response: "Yes, it’s a good time to book." }
];

const DANGER_WORDS = ["bomb", "attack", "terrorist", "explosive", "kill"];
const SECRET_KEY = "secret-key";
const MESSAGE_FETCH_INTERVAL = 5000;

const Chat = () => {
  const [wallet, setWallet] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isFlagged, setIsFlagged] = useState(false);
  const [visualAlert, setVisualAlert] = useState(false);
  const [nsfwModel, setNsfwModel] = useState(null);
  const [cocoModel, setCocoModel] = useState(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [isRecipientFlagged, setIsRecipientFlagged] = useState(false);

  const checkFlagStatus = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract("0xYOUR_DEPLOYED_CONTRACT", ["function isFlagged(address) view returns (bool)"], provider);
      const result = await contract.isFlagged(recipient);
      setIsRecipientFlagged(result);
    } catch (err) {
      console.error("Check failed", err);
    }
  };

  const fetchMessages = async () => {
    if (!wallet || !recipient) return;

    try {
      const res = await fetch(`http://localhost:4000/messages?user=${wallet}&peer=${recipient}`);
      const data = await res.json();
      const formatted = data.map(msg => ({
        sender: msg.sender,
        recipient: msg.recipient,
        text: msg.text,
        isEncrypted: true
      }));
      setMessages(formatted);
    } catch (err) {
      console.error("❌ Error fetching messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages(); // initial fetch
    const interval = setInterval(fetchMessages, MESSAGE_FETCH_INTERVAL); // poll every 5 sec
    return () => clearInterval(interval); // cleanup on unmount
  }, [wallet, recipient]);

  useEffect(() => {
    if (recipient) checkFlagStatus();
  }, [recipient]);

  useEffect(() => {
    const loadModels = async () => {
      const cocoModel = await cocoSsd.load();
      const nsfwModel = await nsfwjs.load();
      setCocoModel(cocoModel);
      setNsfwModel(nsfwModel);
    };
    loadModels();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setWallet(accounts[0]);
      } catch (err) {
        console.error("Wallet connection rejected");
      }
    } else {
      alert("Please install MetaMask to use SanvadAI.");
    }
  };

  const handleSend = async () => {
    if (!wallet || !recipient) {
      alert("Please connect wallet and enter recipient.");
      return;
    }

    if (DANGER_WORDS.some(word => message.toLowerCase().includes(word))) {
      setIsFlagged(true);
      setVisualAlert(true);
      new Audio("/beep.mp3").play();
      setTimeout(() => setVisualAlert(false), 1500);
      return;
    }

    const encrypted = CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
    const myMessage = { text: encrypted, sender: wallet, recipient, isEncrypted: true };

    setMessages(prev => [...prev, myMessage]);
    await sendMessageToServer(wallet, recipient, encrypted);
    setMessage("");

    // Simulate auto-reply
    setTimeout(() => {
      if (!autoReplyEnabled) return;
      const decryptedText = CryptoJS.AES.decrypt(encrypted, SECRET_KEY).toString(CryptoJS.enc.Utf8).trim();
      const aiReply = generateAutoReply([{ text: decryptedText, sender: "user", recipient: wallet, isEncrypted: false }]);
      if (aiReply) {
        const aiMessage = { text: aiReply, sender: recipient, recipient: wallet, isEncrypted: false };
        setMessages(prev => [...prev, aiMessage]);
      }
    }, 800);
  };

  const sendMessageToServer = async (sender, recipient, text) => {
    try {
      await fetch("http://localhost:4000/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, recipient, text })
      });
    } catch (err) {
      console.error("❌ Failed to send message to backend:", err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !nsfwModel || !cocoModel || !wallet || !recipient) return;

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.display = "none";
    document.body.appendChild(img);

    await new Promise(resolve => { img.onload = resolve; });

    const nsfwPredictions = await nsfwModel.classify(img);
    const isNsfw = nsfwPredictions.some(p => ["Porn", "Hentai", "Sexy"].includes(p.className) && p.probability > 0.7);
    const cocoPredictions = await cocoModel.detect(img);
    const isThreat = cocoPredictions.some(p => ["knife", "scissors", "sports ball", "baseball bat", "backpack"].includes(p.class) && p.score > 0.6);

    document.body.removeChild(img);

    if (isNsfw || isThreat) {
      setIsFlagged(true);
      setVisualAlert(true);
      new Audio("/beep.mp3").play();
      setTimeout(() => setIsFlagged(false), 3000);
      await flagSuspiciousUser (wallet);
      return;
    }

    const newMsg = { sender: wallet, recipient, isImage: true, imageUrl: URL.createObjectURL(file) };
    setMessages(prev => [...prev, newMsg]);
  };

  const flagSuspiciousUser  = async (user) => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract("0xD4AE5c16AcdB910a577e6ba23A93Bd23d81984A5", ["function flagSuspicious(address _user)"], signer);
      await contract.flagSuspicious(user);
    } catch (err) {
      console.error("Flagging failed:", err);
    }
  };

  const generateAutoReply = (previousMessages) => {
    if (!previousMessages || previousMessages.length === 0) return null;

    const lastMsg = previousMessages[previousMessages.length - 1];
    if (!lastMsg || lastMsg.sender !== "user" || lastMsg.isEncrypted) return null;

    for (let known of KNOWN_MESSAGES) {
      const score = similarity(lastMsg.text, known.text);
      if (score >= 0.95) return known.response;
    }
    return null;
  };

  const similarity = (str1, str2) => {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    const set1 = new Set(str1.split(" "));
    const set2 = new Set(str2.split(" "));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
  };

  const handleDecrypt = (index) => {
    const msg = messages[index];
    if (msg.isEncrypted) {
      const decryptedText = CryptoJS.AES.decrypt(msg.text, SECRET_KEY).toString(CryptoJS.enc.Utf8);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[index] = { ...msg, text: decryptedText, isEncrypted: false };
        return newMessages;
      });
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px", color: "white" }}>
      {!wallet ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <p style={{ fontSize: "0.9rem", color: "#ccc" }}>
          Connected: <b>{wallet.slice(0, 6)}...{wallet.slice(-4)}</b>
        </p>
      )}

      <input
        type="text"
        placeholder="Enter recipient wallet address"
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
        style={{ padding: "8px", width: "70%", borderRadius: "6px", margin: "10px 0" }}
      />

      {isFlagged && <div className="flag-warning">🚨 Suspicious message blocked and flagged anonymously on-chain!</div>}

      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ marginBottom: "10px" }} />

      <div className={`chat-box ${visualAlert ? "visual-alert" : ""}`}>
        {messages.filter(msg => (msg.sender === wallet && msg.recipient === recipient) || (msg.sender === recipient && msg.recipient === wallet))
          .map((msg, i) => (
            <div key={i} className="chat-bubble" style={{
              backgroundColor: msg.sender === wallet ? "#ffc107" : "#333",
              color: msg.sender === wallet ? "#000" : "#fff",
              padding: "10px",
              borderRadius: "12px",
              margin: "8px",
              textAlign: msg.sender === wallet ? "right" : "left",
              maxWidth: "60%",
              alignSelf: msg.sender === wallet ? "flex-end" : "flex-start",
              cursor: msg.isEncrypted ? "pointer" : "default",
              wordBreak: "break-word"
            }} onClick={() => msg.isEncrypted && handleDecrypt(i)}>
              {msg.isImage ? (
                <img src={msg.imageUrl} alt="uploaded" style={{ maxWidth: "200px", borderRadius: "10px" }} />
              ) : msg.isEncrypted ? "🔒 Click to Decrypt" : msg.text}
            </div>
          ))}
      </div>

      <button onClick={() => setAutoReplyEnabled(!autoReplyEnabled)} style={{ marginBottom: "10px" }}>
        Auto-Reply: {autoReplyEnabled ? "ON" : "OFF"}
      </button>

      <button onClick={() => setMessages([])} style={{ marginTop: "10px" }}>
        🗑️ Clear Chat
      </button>

      {isRecipientFlagged && <div style={{ color: "red" }}>⚠️ This recipient is flagged for suspicious behavior.</div>}

      <div style={{ marginTop: "10px" }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter your message"
          style={{ padding: "10px", width: "60%", borderRadius: "5px", border: "none", marginRight: "10px" }}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
