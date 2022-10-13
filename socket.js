const { Server } = require("socket.io");

let io;

module.exports = {
  initIO: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "http://localhost:3000", // To allow all origins you could use "*"
      },
    });
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },
};
