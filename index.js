const express = require("express");
const { createServer } = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const users = {};

const userGames = {};

const getUid = () => String(Date.now()).slice(-4);

const winningMatch = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

function winner(roomId) {
    let text = false;
    const status = userGames[roomId].state;

    winningMatch.forEach((item) => {
        const [a, b, c] = item;
        if (status[a] && status[a] === status[b] && status[b] === status[c]) {
            text = true;
        }
    });
    return text;
}

io.on("connection", (socket) => {
    socket.on("play", (index) => {
        const data = +index;
        const playRoom = Array.from(socket.rooms)[1];

        const playerTurn = userGames[playRoom].turn;

        if (
            userGames[playRoom].state[data] ||
            (playerTurn && userGames[playRoom].player2 == socket.id) ||
            (playerTurn === false && userGames[playRoom].player1 == socket.id) ||
            (userGames[playRoom].player2 === null) ||
            userGames[playRoom].win===true
        ) {
            
            return;
        }

        userGames[playRoom].state[data] = playerTurn ? "X" : "O";

        io.in(playRoom).emit("stateChange", userGames[playRoom].state);
        if (winner(playRoom)) {
            io.in(playRoom).emit("winner", {
                winMessage: `${
                    users[
                        userGames[playRoom][playerTurn ? "player1" : "player2"]
                    ]
                } win the game congratulations 🏆🏆🏆`,
                runMessage: `your are lost the game`,
                winColor: "bg-lime-500",
                runColor: "bg-rose-500",
                winner: playerTurn
                    ? users[userGames[playRoom].player1]
                    : users[userGames[playRoom].player2],
            });
            userGames[playRoom].win = true
            return;
        } else if (!userGames[playRoom].state.some((item) => item === null)) {
            io.in(playRoom).emit("matchDraw", {
                message: "match draw have the nice day",
                color: "bg-sky-400",
            });
            console.log("match draw have the nice day");
            return;
        }

        io.in(playRoom).emit(
            "message",
            `hey ${
                playerTurn
                    ? users[userGames[playRoom].player2]
                    : users[userGames[playRoom].player1]
            } it's your turn`
        );
        userGames[playRoom].turn = !playerTurn;
    });

    socket.on("resetTheGame",()=>{
        const playRoom = Array.from(socket.rooms)[1];
        console.log(userGames[playRoom])
        userGames[playRoom].win = false
        userGames[playRoom].state.fill(null)
        io.in(playRoom).emit(
            "message",
            `hey ${
                true
                    ? users[userGames[playRoom].player2]
                    : users[userGames[playRoom].player1]
            } it's your turn`
        );
        io.in(playRoom).emit("gameReset")
    })

    socket.on("createNewGame", (name, callback) => {
        const newId = getUid();
        users[socket.id] = name;

        userGames[newId] = {
            player1: socket.id,
            player2: null,
            turn: true,
            state: Array(9).fill(null),
            win:false
        };
        socket.join(newId);
        console.log(Array.from(socket.rooms));
        console.log("game created", users[socket.id], newId);
        callback({ status: "success", gameId: newId });
    });

    socket.on("joinTheGame", (name, gameId, callback) => {
        const player = userGames[gameId]?.player2;
        console.log("join requests", gameId);
        if (player === null) {
            socket.join(gameId);
            const playerName = users[userGames[gameId].player1];
            callback({
                status: "success",
                player: playerName,
            });
            userGames[gameId].player2 = socket.id;
            users[socket.id] = name
            socket.to(userGames[gameId].player1).emit("playerJoin", name);

            io.in(gameId).emit("message", `hey ${playerName} it's your turn`);
        } else if (player) {
            callback({
                status: "playing",
            });
        } else {
            callback({ status: "invalid code" });
        }
    });
});

httpServer.listen(process.env.PORT || 3000, () =>
    console.log("server running...")
);
