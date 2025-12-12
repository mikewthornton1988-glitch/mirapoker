const socket = new WebSocket(`wss://${location.host}`);

let playerId = null;
let currentTable = null;
let tableState = null;

// JOIN TABLE AFTER USER SELECTS
function joinSelectedTable() {
    const selectedTable = Number(document.getElementById("tableNumber").value);
    currentTable = selectedTable;

    socket.send(JSON.stringify({
        type: "join_table",
        table: selectedTable
    }));

    document.getElementById("tableInfo").innerText =
        `Connecting to Table ${selectedTable}...`;
}

// CONNECT
socket.onopen = () => {
    console.log("Connected to Mirapoker server");
};

// RECEIVE MESSAGES
socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
        case "welcome":
            playerId = msg.playerId;
            break;

        case "state":
            updateUI(msg.state);
            break;
    }
};

// UPDATE UI
function updateUI(state) {
    tableState = state;

    if (!state) return;

    document.getElementById("tableInfo").innerText =
        `Connected to Table ${currentTable}`;

    // update board
    let b = state.board || [];
    document.getElementById("board").innerText =
        `Board: [ ${b[0] || "?"} ${b[1] || "?"} ${b[2] || "?"} | ${b[3] || "?"} | ${b[4] || "?"} ]`;

    // update hand
    let myHand = state.hands?.[playerId] || ["?", "?"];
    document.getElementById("hand").innerText =
        `Your Hand: [ ${myHand[0]} ${myHand[1]} ]`;

    // update players
    const pDiv = document.getElementById("players");
    pDiv.innerHTML = "";
    Object.values(state.players || {}).forEach(p => {
        const el = document.createElement("div");
        el.innerText = `Seat ${p.seat}: ${p.name} – Chips: ${p.stack}`;
        pDiv.appendChild(el);
    });
}

// ACTIONS
function sendAction(action) {
    if (!currentTable) return alert("Join a table first!");

    socket.send(JSON.stringify({
        type: "action",
        action: action,
        table: currentTable,
        playerId: playerId
    }));
                                                             }
