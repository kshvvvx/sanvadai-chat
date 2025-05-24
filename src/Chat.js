import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import CryptoJS from "crypto-js";
import * as nsfwjs from "nsfwjs";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { useEffect } from "react";


const knownMessages = [
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


 function similarity(str1, str2) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();

  const set1 = new Set(str1.split(" "));
  const set2 = new Set(str2.split(" "));
  const intersection = new Set([...set1].filter(x => set2.has(x)));

  const score = intersection.size / Math.max(set1.size, set2.size);
  return score;
}

function generateAutoReply(previousMessages) {
  if (!previousMessages || previousMessages.length === 0) return null;

  const lastMsg = previousMessages[previousMessages.length - 1];
  console.log("🧠 Last message:", lastMsg);

  if (!lastMsg || lastMsg.sender !== "user" || lastMsg.encrypted || lastMsg.flagged) {
    console.log("❌ Message not eligible for auto-reply");
    return null;
  }

  for (let known of knownMessages) {
    const score = similarity(lastMsg.text, known.text);
    console.log(`🔍 Comparing: "${lastMsg.text}" vs "${known.text}" → score: ${score}`);
    if (score >= 0.95) {
      console.log("✅ Match found! Sending auto-reply:", known.response);
      return known.response;
    }
  }

  console.log("⚠️ No match found for auto-reply");
  return null;
}




// 🔐 Danger keywords
const initialDangerWords = ["bomb", "attack", "terrorist", "explosive", "kill"];

const Chat = () => {
  const [wallet, setWallet] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [dangerWords] = useState(initialDangerWords);
  const [isFlagged, setIsFlagged] = useState(false);
  const [visualAlert, setVisualAlert] = useState(false);
  const [nsfwModel, setNsfwModel] = useState(null);
  const [cocoModel, setCocoModel] = useState(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [isRecipientFlagged, setIsRecipientFlagged] = useState(false);

const checkFlagStatus = async () => {
  try {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(
      "0xYOUR_DEPLOYED_CONTRACT",
      ["function isFlagged(address) view returns (bool)"],
      provider
    );
    const result = await contract.isFlagged(recipient);
    setIsRecipientFlagged(result);
  } catch (err) {
    console.error("Check failed", err);
  }
};


const sendMessage = ({ text, sender }) => {
  setMessages(prev => [
    ...prev,
    {
      text,
      sender,
      recipient,
      isEncrypted: false
    }
  ]);
};



useEffect(() => {
  const fetchMessages = async () => {
    if (!wallet || !recipient) return;

    try {
      const res = await fetch(
        `http://localhost:4000/messages?user=${wallet}&peer=${recipient}`
      );
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

  fetchMessages(); // initial fetch
  const interval = setInterval(fetchMessages, 5000); // poll every 5 sec

  return () => clearInterval(interval); // cleanup on unmount
}, [wallet, recipient]);


useEffect(() => {
  const fetchMessages = async () => {
    if (!wallet || !recipient) return;
    const res = await fetch(`http://localhost:4000/messages?user=${wallet}&peer=${recipient}`);
    const data = await res.json();
    setMessages(data);
  };

  const interval = setInterval(fetchMessages, 2000); // poll every 2 seconds
  return () => clearInterval(interval);
}, [wallet, recipient]);



useEffect(() => {
  if (recipient) checkFlagStatus();
}, [recipient]);

  

useEffect(() => {
  const loadCoco = async () => {
    const model = await cocoSsd.load();
    setCocoModel(model);
  };
  loadCoco();
}, []);


useEffect(() => {
  const loadModel = async () => {
    const model = await nsfwjs.load();
    setNsfwModel(model);
  };
  loadModel();
}, []);

useEffect(() => {
  const saved = localStorage.getItem("chatMessages");
  if (saved) {
    setMessages(JSON.parse(saved));
  }
}, []);
useEffect(() => {
  localStorage.setItem("chatMessages", JSON.stringify(messages));
}, [messages]);


  // ✅ Connect wallet
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

  // ✅ Handle message send
  const handleSend = async () => {
  if (!wallet || !recipient) {
    alert("Please connect wallet and enter recipient.");
    return;
  }

  const isDangerous = dangerWords.some(word =>
    message.toLowerCase().includes(word)
  );

  if (isDangerous) {
    setIsFlagged(true);
    setVisualAlert(true);
    new Audio("/beep.mp3").play();
    setTimeout(() => setVisualAlert(false), 1500);
    return;
  }

  const encrypted = CryptoJS.AES.encrypt(message, "secret-key").toString();

  // You → Send
  const myMessage = {
    text: encrypted,
    sender: wallet,
    recipient,
    isEncrypted: true
  };

  setMessages(prev => [...prev, myMessage]);
  await fetch("http://localhost:4000/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sender: wallet,
    recipient,
    text: encrypted
  })
});

try {
  await fetch("http://localhost:4000/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: wallet,
      recipient: recipient,
      text: encrypted
    })
  });
} catch (err) {
  console.error("❌ Failed to send message to backend:", err);
}



  setMessage("");

  // Simulate fake message as if the recipient received it and is replying
  setTimeout(() => {
    
  if (!autoReplyEnabled) return; // ← prevent replies if toggle is OFF

    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, "secret-key");
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8).trim();

      // Fake incoming from recipient
      const fakeIncoming = {
        text: decryptedText,
        sender: "user",
        recipient: wallet,
        isEncrypted: false
      };

      const aiReply = generateAutoReply([fakeIncoming]);
      if (aiReply) {
        const aiMessage = {
  text: aiReply,
  sender: recipient,  // <- make it look like it came from the other person
  recipient: wallet,
  isEncrypted: false
};

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error("AI simulation error", err);
    }
  }, 800); // Simulate delay
};


  // ✅ Decrypt on click
  const handleDecrypt = (index) => {
    setMessages(prevMessages => {
      const updated = [...prevMessages];
      const encryptedText = updated[index].text;
  
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, "secret-key");
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8).trim();
  
        if (!decryptedText || decryptedText.length < 1) {
          throw new Error("Empty or invalid decryption");
        }
  
        updated[index] = {
          ...updated[index],
          text: decryptedText,
          isEncrypted: false,
        };
      } catch (err) {
        console.error("Decryption failed:", err);
        updated[index] = {
          ...updated[index],
          text: "❌ Decryption failed.",
          isEncrypted: false,
        };
      }
  
      return updated;
    });
  };
  const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file || !nsfwModel || !cocoModel || !wallet || !recipient) return;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.style.display = "none";
  document.body.appendChild(img);

  await new Promise(resolve => { img.onload = resolve; });

  // 🔒 Check for NSFW content
  const nsfwPredictions = await nsfwModel.classify(img);
  const isNsfw = nsfwPredictions.some(p =>
    ["Porn", "Hentai", "Sexy"].includes(p.className) && p.probability > 0.7
  );

  // 🔫 Check for weapons or threats using COCO
  const cocoPredictions = await cocoModel.detect(img);
  const isThreat = cocoPredictions.some(p =>
    ["knife", "scissors", "sports ball", "baseball bat", "backpack"].includes(p.class) &&
    p.score > 0.6
  );

  document.body.removeChild(img);

  if (isNsfw || isThreat) {
  setIsFlagged(true);
  setVisualAlert(true);
  new Audio("/beep.mp3").play();
  setTimeout(() => setIsFlagged(false), 3000); // Reset warning

  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(
      "0xD4AE5c16AcdB910a577e6ba23A93Bd23d81984A5",
      ["function flagSuspicious(address _user)"],
      signer
    );
    await contract.flagSuspicious(wallet);
  } catch (err) {
    console.error("Flagging failed:", err);
  }

  return;
}

  // ✅ Safe image → send in chat
  const newMsg = {
    sender: wallet,
    recipient,
    isImage: true,
    imageUrl: URL.createObjectURL(file)
  };
  setMessages(prev => [...prev, newMsg]);
};


  
  

  return (
    <div style={{ textAlign: "center", padding: "20px", color: "white" }}>
      {/* 🔌 Wallet connect */}
      {!wallet ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <p style={{ fontSize: "0.9rem", color: "#ccc" }}>
          Connected: <b>{wallet.slice(0, 6)}...{wallet.slice(-4)}</b>
        </p>
      )}

      {/* 👥 Recipient wallet input */}
      <input
        type="text"
        placeholder="Enter recipient wallet address"
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
        style={{
          padding: "8px",
          width: "70%",
          borderRadius: "6px",
          margin: "10px 0"
        }}
      />

      {/* 🚨 Suspicious warning */}
      {isFlagged && (
        <div className="flag-warning">
          🚨 Suspicious message blocked and flagged anonymously on-chain!
        </div>
      )}

      <input
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
  style={{ marginBottom: "10px" }}
/>



      {/* 💬 Chat display */}
      <div className={`chat-box ${visualAlert ? "visual-alert" : ""}`}>
        {messages
          .filter(msg =>
            (msg.sender === wallet && msg.recipient === recipient) ||
            (msg.sender === recipient && msg.recipient === wallet)
          )
          .map((msg, i) => (
            <div
              key={i}
              className="chat-bubble"
              style={{
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
              }}
              onClick={() => msg.isEncrypted && handleDecrypt(i)}
            >
              
              {msg.isImage ? (
  <img src={msg.imageUrl} alt="uploaded" style={{ maxWidth: "200px", borderRadius: "10px" }} />
) : msg.isEncrypted ? "🔒 Click to Decrypt" : msg.text}

            </div>
          ))}
      </div>

      {/* 🤖 Auto-Reply Toggle */}
<button onClick={() => setAutoReplyEnabled(!autoReplyEnabled)} style={{ marginBottom: "10px" }}>
  Auto-Reply: {autoReplyEnabled ? "ON" : "OFF"}
</button>

       <button onClick={() => setMessages([])} style={{ marginTop: "10px" }}>
  🗑️ Clear Chat
</button>

{isRecipientFlagged && (
  <div style={{ color: "red" }}>
    ⚠️ This recipient is flagged for suspicious behavior.
  </div>
)}


      {/* ✍️ Message input */}
      <div style={{ marginTop: "10px" }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter your message"
          style={{
            padding: "10px",
            width: "60%",
            borderRadius: "5px",
            border: "none",
            marginRight: "10px"
          }}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
