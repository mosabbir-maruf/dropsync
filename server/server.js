const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const app = express();

// Create a basic HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("🟢 New WebSocket connection established");

  // Listen for messages from clients
  ws.on("message", (message) => {
    console.log("📩 Received message:", message);

    // Parse the message
    const msg = JSON.parse(message);

    // Handle different message types
    if (msg.type === "new_device") {
      // Handle new device registration
      console.log(`New device connected: ${msg.deviceName}`);
      // Broadcast the new device to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "new_device", deviceName: msg.deviceName }));
        }
      });
    }

    if (msg.type === "offer" || msg.type === "answer" || msg.type === "icecandidate") {
      // Relay offer/answer/ICE candidate to the intended recipient
      const targetClient = Array.from(wss.clients).find(
        (client) => client.deviceId === msg.to
      );
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        targetClient.send(message);
      }
    }
  });

  // Assign device name or ID
  ws.deviceId = Math.floor(Math.random() * 10000); // Unique ID or device name

  // Send a welcome message to the client
  ws.send(JSON.stringify({ type: "welcome", deviceId: ws.deviceId }));
});

// Listen on a port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
