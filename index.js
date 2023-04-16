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

const status = Array(9).fill(null);

function winner() {
    let text = false;
    winningMatch.forEach((item) => {
        const [a, b, c] = item;
        if (status[a] && status[a] === status[b] && status[b] === status[c]) {
            text = true;
        }
    });
    return text;
}

let flag = true;

io.on("connection", (socket) => {
    socket.on("play", (data) => {
        console.log(data);
        console.log(status[data.data])
        if (status[data.data] || (flag && !data.code) || (!flag && data.code)) return;
        const currentRoom = data.room || data.code;
        status[data.data] = data.code ? "X" : "O";
        io.in(currentRoom).emit("stateChange", status);
        if(winner()){
            io.in(currentRoom).emit("winner",{
                flag,
                winMessage:`${status[data.data]} win the game congratulations 🏆🏆🏆`,
                runMessage:`your are lost the game`,
                winColor:"bg-lime-500",
                runColor:"bg-orange-400"
            })
            flag = true;
            status.fill(null)
            return
        }else if(!status.some(item=> item===null)){
            io.in(currentRoom).emit("matchDraw",{
                message:"match was draw",
                color:"zinc"
            })
            flag = true;
            status.fill(null)
            return
        }

        io.in(currentRoom).emit(
            "message",
            `hey ${
                data.player
                    ? users[userGames[currentRoom].admin].name
                    : userGames[currentRoom].player
            } it's your turn`
        );
        console.log(status);
        flag = !flag;
    });
    socket.on("createNewGame", (name, callback) => {
        const newId = getUid();
        users[socket.id] = {
            name,
        };
        userGames[newId] = {
            admin: socket.id,
            player: "waiting",
        };
        socket.join(newId);
        callback({ status: "success", gameId: newId });
        console.log("game created", users[socket.id], newId);
    });
    socket.on("joinTheGame", (name, gameId, callback) => {
        const player = userGames?.[gameId]?.player;
        console.log("join requests", gameId);
        if (player) {
            if (player === "waiting") {
                socket.join(gameId);
                callback({
                    status: "success",
                    player: users[userGames[gameId].admin].name,
                });
                userGames[gameId].player = name;
                console.log(userGames[gameId].admin);
                socket.to(userGames[gameId].admin).emit("playerJoin", name);
                io.in(gameId).emit(
                    "message",
                    `hey ${users[userGames[gameId].admin].name} it's your turn`
                );
            } else {
                callback({
                    status: "playing",
                });
            }
        } else {
            callback({ status: "invalid code" });
        }
    });
});

httpServer.listen(3000, () => console.log("server running..."));
