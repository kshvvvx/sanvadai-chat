const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/sanvadai-chat");

const Message = mongoose.model("Message", {
  sender: String,
  recipient: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});

app.post("/message", async (req, res) => {
  const newMsg = await Message.create(req.body);
  res.json(newMsg);
});

app.get("/messages", async (req, res) => {
  const { user, peer } = req.query;
  const msgs = await Message.find({
    $or: [
      { sender: user, recipient: peer },
      { sender: peer, recipient: user }
    ]
  }).sort({ timestamp: 1 });
  res.json(msgs);
});

app.listen(4000, () => console.log("✅ Server running on http://localhost:4000"));
