const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// SERVE STATIC UI FILES
// -----------------------------
app.use(express.static(path.join(__dirname, "client")));

// -----------------------------
// TABLE CONFIG
// -----------------------------
const TABLE_COUNT = 5;
const SEATS_PER_TABLE = 6;

let tables = {};
for (let t = 1; t <= TABLE_COUNT; t++) {
    tables[t] = {
        players: {},  // seat -> { id, ws, name, stack, cards, isAdmin }
        spectators: [], // admin-mode watchers
        gameState: {},  // flop, turn, river, pot, actions
        pendingBuyIns: []
    };
}

// -----------------------------
// HTTP ROUTES
// -----------------------------

// Player table join
app.get("/table/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "table.html"));
});

// Admin observer mode
app.get("/admin/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "admin.html"));
});

// Health check (Render)
app.get("/", (req, res) => {
    res.send("Mirapoker server running.");
});

// -----------------------------
// WEBSOCKET SERVER
// -----------------------------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// broadcast state to everyone at a table
function broadcastTable(tableId) {
    const table = tables[tableId];
    const message = JSON.stringify({
        type: "update",
        gameState: table.gameState,
        players: Object.fromEntries(
            Object.entries(table.players).map(([seat, p]) => [
                seat,
                { name: p.name, stack: p.stack, cards: p.isAdmin ? p.cards : undefined }
            ])
        )
    });

    for (const p of Object.values(table.players)) {
        if (p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(message);
    }
    for (const s of table.spectators) {
        if (s.readyState === WebSocket.OPEN) s.send(message);
    }
}

wss.on("connection", (ws, req) => {
    const params = new URLSearchParams(req.url.replace("/?", ""));
    const mode = params.get("mode"); // player or admin
    const tableId = parseInt(params.get("table"));
    const seat = params.get("seat");
    const name = params.get("name") || "Player";

    if (!tables[tableId]) {
        ws.send(JSON.stringify({ error: "Invalid table" }));
        ws.close();
        return;
    }

    const table = tables[tableId];

    // -----------------------
    // ADMIN OBSERVER
    // -----------------------
    if (mode === "admin") {
        ws.isAdmin = true;
        table.spectators.push(ws);

        ws.send(JSON.stringify({ type: "admin_connected", tableId }));
        broadcastTable(tableId);

        ws.on("close", () => {
            table.spectators = table.spectators.filter(s => s !== ws);
        });
        return;
    }

    // -----------------------
    // PLAYER CONNECTION
    // -----------------------
    if (!seat || seat < 1 || seat > SEATS_PER_TABLE) {
        ws.send(JSON.stringify({ error: "Invalid seat" }));
        ws.close();
        return;
    }

    if (table.players[seat]) {
        ws.send(JSON.stringify({ error: "Seat taken" }));
        ws.close();
        return;
    }

    const id = uuidv4();
    table.players[seat] = {
        id,
        ws,
        name,
        stack: 500,  // default stack; Astrea will update this
        cards: [],
        isAdmin: false
    };

    ws.send(JSON.stringify({
        type: "joined",
        tableId,
        seat,
        name,
        stack: table.players[seat].stack
    }));

    broadcastTable(tableId);

    // disconnect logic
    ws.on("close", () => {
        delete table.players[seat];
        broadcastTable(tableId);
    });

    // receive messages
    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === "action") {
                // player bet/check/fold here
                table.gameState.lastAction = {
                    seat,
                    action: data.action,
                    amount: data.amount || 0
                };

                broadcastTable(tableId);
            }

            if (data.type === "setCards" && ws.isAdmin) {
                // Admin can reveal cards
                if (table.players[data.seat]) {
                    table.players[data.seat].cards = data.cards;
                }
                broadcastTable(tableId);
            }

        } catch (e) {
            console.log("Bad WS message", e);
        }
    });
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Mirapoker running on port " + PORT);
});
