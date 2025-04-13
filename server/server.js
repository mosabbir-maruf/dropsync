const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });
console.log("🚀 WebSocket signaling server started on ws://localhost:3000");

let devices = [];

wss.on("connection", (ws) => {
  console.log("🟢 New device connected");
  
  ws.on("message", (message) => {
    const msg = JSON.parse(message);
    
    // Handle new device connection
    if (msg.type === "new_device") {
      const deviceId = `Device-${Date.now()}`;
      devices.push({ ws, id: deviceId, name: msg.deviceName || deviceId });
      console.log(`New device added: ${deviceId}`);

      // Broadcast new device to all other devices
      devices.forEach(device => {
        if (device.ws !== ws) {
          device.ws.send(JSON.stringify({ type: "new_device", deviceName: device.name, id: device.id }));
        }
      });
    }

    // Handle file offer/answer/icecandidate
    if (msg.type === "offer" || msg.type === "answer" || msg.type === "icecandidate") {
      const targetDevice = devices.find(device => device.id === msg.to);
      if (targetDevice) {
        targetDevice.ws.send(JSON.stringify(msg));
      }
    }

    // Handle message sending
    if (msg.type === "message") {
      const targetDevice = devices.find(device => device.id === msg.to);
      if (targetDevice) {
        targetDevice.ws.send(JSON.stringify(msg));
      }
    }
  });

  ws.on("close", () => {
    devices = devices.filter(device => device.ws !== ws);
    console.log("🔴 Device disconnected");
  });
});
