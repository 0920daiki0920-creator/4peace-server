const ws = new WebSocket(
  location.protocol === "https:"
    ? `wss://${location.host}`
    : `ws://${location.host}`
);

const info = document.getElementById("info");

function createRoom() {
  ws.send(JSON.stringify({ type: "create" }));
}

function joinRoom() {
  const room = document.getElementById("roomInput").value;
  ws.send(JSON.stringify({ type: "join", room }));
}

ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  console.log(msg); // ←確認用

  if (msg.type === "created") {
    info.innerText = "ルームコード: " + msg.room;
  }

  if (msg.type === "joined") {
    info.innerText = "参加成功！";
  }
};
