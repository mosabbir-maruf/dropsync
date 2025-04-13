const socket = new WebSocket("wss://dropsync.onrender.com:3000");  // Updated WebSocket URL
let localDeviceName = null;
let peerConnection;
let dataChannel;
let fileInput = document.getElementById("fileInput");
let sendFileBtn = document.getElementById("sendFileBtn");
let deviceList = document.getElementById("deviceList");
let fileStatus = document.getElementById("fileStatus");
let messageInput = document.getElementById("messageInput");
let sendMessageBtn = document.getElementById("sendMessageBtn");
let chatWindow = document.getElementById("chatWindow");

document.getElementById("setNameBtn").addEventListener("click", () => {
  localDeviceName = document.getElementById("deviceName").value;
  if (localDeviceName) {
    socket.send(JSON.stringify({ type: "new_device", deviceName: localDeviceName }));
    document.getElementById("status").innerText = `Device name set to: ${localDeviceName}`;
    document.getElementById("status").style.display = "block";
  }
});

// Connect to signaling server
socket.addEventListener("open", () => {
  console.log("🟢 Connected to signaling server");
});

// Handle incoming WebSocket messages
socket.addEventListener("message", (event) => {
  let message = JSON.parse(event.data);
  console.log("📩 Received message:", message);

  if (message.type === "new_device") {
    let deviceItem = document.createElement("li");
    deviceItem.textContent = message.deviceName || `Device-${message.id}`;
    deviceItem.addEventListener("click", () => initiateFileTransfer(message.id));
    deviceList.appendChild(deviceItem);
  }

  if (message.type === "offer") {
    handleOffer(message);
  }

  if (message.type === "answer") {
    handleAnswer(message);
  }

  if (message.type === "icecandidate") {
    handleIceCandidate(message);
  }

  if (message.type === "message") {
    displayMessage(message.text);
  }
});

function initiateFileTransfer(deviceId) {
  peerConnection = new RTCPeerConnection();
  dataChannel = peerConnection.createDataChannel("fileTransfer");

  dataChannel.onopen = () => {
    console.log("DataChannel open!");
    sendFileBtn.disabled = false;
    sendMessageBtn.disabled = false;
  };

  dataChannel.onerror = (error) => {
    console.log("DataChannel error:", error);
  };

  dataChannel.onclose = () => {
    console.log("DataChannel closed!");
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate, to: deviceId }));
    }
  };

  peerConnection.createOffer()
    .then((offer) => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.send(JSON.stringify({ type: "offer", offer: peerConnection.localDescription, to: deviceId }));
    })
    .catch((error) => console.error("Error during offer creation:", error));
}

function handleOffer(message) {
  peerConnection = new RTCPeerConnection();
  peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: "icecandidate", candidate: event.candidate, to: message.from }));
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;

    dataChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "message") {
            displayMessage(msg.text);
          }
        } catch {
          displayMessage(event.data);
        }
      } else {
        const blob = new Blob([event.data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "received_file";
        a.click();
        fileStatus.textContent = "File received!";
        fileStatus.style.color = "green";
      }
    };

    dataChannel.onopen = () => {
      console.log("DataChannel open!");
      sendFileBtn.disabled = false;
      sendMessageBtn.disabled = false;
    };

    dataChannel.onerror = (error) => {
      console.log("DataChannel error:", error);
    };

    dataChannel.onclose = () => {
      console.log("DataChannel closed!");
    };
  };

  peerConnection.createAnswer()
    .then((answer) => peerConnection.setLocalDescription(answer))
    .then(() => {
      socket.send(JSON.stringify({ type: "answer", answer: peerConnection.localDescription, to: message.from }));
    })
    .catch((error) => console.error("Error during answer creation:", error));
}

function handleAnswer(message) {
  peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
}

function handleIceCandidate(message) {
  peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
}

sendFileBtn.addEventListener("click", () => {
  if (dataChannel && dataChannel.readyState === "open") {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      dataChannel.send(reader.result);
      fileStatus.textContent = "File sent successfully!";
      fileStatus.style.color = "green";
    };

    reader.onerror = () => {
      fileStatus.textContent = "Error reading file!";
      fileStatus.style.color = "red";
    };

    reader.readAsArrayBuffer(file);
  } else {
    console.log("❌ DataChannel is not open yet!");
    fileStatus.textContent = "Waiting for DataChannel to open...";
    fileStatus.style.color = "orange";
  }
});

sendMessageBtn.addEventListener("click", () => {
  const messageText = messageInput.value;
  if (messageText && dataChannel && dataChannel.readyState === "open") {
    const msg = { type: "message", text: messageText };
    dataChannel.send(JSON.stringify(msg));
    displayMessage(`You: ${messageText}`, true);
    messageInput.value = "";
  } else {
    console.log("❌ DataChannel is not open or message is empty!");
  }
});

function displayMessage(messageText, isOwnMessage = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add(isOwnMessage ? "message-own" : "message-other");
  messageElement.textContent = messageText;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
