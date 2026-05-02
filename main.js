const ws = new WebSocket(
  location.protocol === "https:"
    ? `wss://${location.host}`
    : `ws://${location.host}`
);

const info = document.getElementById("info");

ws.onopen = () => {
  console.log("接続成功");
};

function createRoom() {
  if (ws.readyState !== 1) {
    alert("まだ接続中");
    return;
  }
  ws.send(JSON.stringify({ type: "create" }));
}

function joinRoom() {
  if (ws.readyState !== 1) {
    alert("まだ接続中");
    return;
  }

  const room = document.getElementById("roomInput").value;
  ws.send(JSON.stringify({ type: "join", room }));
}

ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  console.log(msg);

  if (msg.type === "created") {
    info.innerText = "ルームコード: " + msg.room;
  }

  if (msg.type === "joined") {
    info.innerText = "参加成功！";
  }
};
