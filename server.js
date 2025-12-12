const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "client")));

let tables = {
    1: { players: {}, board: [], deck: [] },
    2: { players: {}, board: [], deck: [] },
    3: { players: {}, board: [], deck: [] }
};

function newDeck() {
    const suits = ["H", "D", "C", "S"];
    const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
    let d = [];
    suits.forEach(s => ranks.forEach(r => d.push(r + s)));
    return d.sort(() => Math.random() - 0.5);
}

function dealCard(deck) {
    return deck.pop();
}

function sendState(tableId) {
    const t = tables[tableId];
    const state = {
        type: "state",
        board: t.board,
        players: Object.values(t.players).map(p => ({
            id: p.id,
            hand: p.hand,
            chips: p.chips
        }))
    };

    Object.values(t.players).forEach(p => {
        p.ws.send(JSON.stringify(state));
    });
}

wss.on("connection", ws => {
    let currentTable = null;
    let playerId = Math.random().toString(36).substring(2, 10);

    ws.on("message", data => {
        let msg = JSON.parse(data);

        if (msg.type === "join_table") {
            let tableId = msg.table;
            currentTable = tableId;

            let t = tables[tableId];

            if (!t.deck.length) {
                t.deck = newDeck();
                t.board = [];
            }

            t.players[playerId] = {
                id: playerId,
                ws: ws,
                hand: [dealCard(t.deck), dealCard(t.deck)],
                chips: 1000
            };

            ws.send(JSON.stringify({ type: "welcome", playerId }));
            sendState(tableId);
        }

        if (msg.type === "action") {
            let t = tables[currentTable];

            if (!t) return;

            if (t.board.length < 5) {
                t.board.push(dealCard(t.deck));
            }

            sendState(currentTable);
        }
    });

    ws.on("close", () => {
        if (currentTable && tables[currentTable].players[playerId]) {
            delete tables[currentTable].players[playerId];
            sendState(currentTable);
        }
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "table.html"));
});

server.listen(process.env.PORT || 3000, () =>
    console.log("Mirapoker server running.")
);
