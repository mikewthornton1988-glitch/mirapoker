const socket = new WebSocket(`wss://${location.host}`);

let playerId = null;
let tableState = null;

socket.onopen = () => {
  console.log("Connected to Mirapoker server");
  socket.send(JSON.stringify({ type: "join_table" }));
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "welcome":
      playerId = msg.playerId;
      break;

    case "state":
      tableState = msg.state;
      renderTable();
      break;

    case "fold":
    case "call":
    case "bet":
    case "check":
      updateActions(msg);
      break;

    default:
      console.log("Unknown message:", msg);
  }
};

function renderTable() {
  const tableDiv = document.getElementById("table");
  tableDiv.innerHTML = "";

  tableState.players.forEach((p) => {
    const el = document.createElement("div");
    el.className = "player";

    let cards = "";

    if (p.id === playerId && p.cards) {
      cards = p.cards.join(" ");
    } else if (p.hasCards) {
      cards = "🂠 🂠";
    }

    el.innerHTML = `
      <strong>${p.name}</strong><br>
      Chips: ${p.chips}<br>
      ${cards}<br>
      Action: ${p.action || ""}
    `;

    tableDiv.appendChild(el);
  });
}

function action(type, amount = null) {
  socket.send(
    JSON.stringify({
      type,
      amount,
      playerId,
    })
  );
  }
