const path = require("path");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const { initIO } = require("./socket");
const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");

const app = express();

app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

// This is the special type of middleware called "error handling middleware" with 4 arguments that Express will
// move right away to it when you can next() with an Error inside:
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500; // Will be 500 if statusCode is undefined
  const message = error.message; // This property exists by default and it holds the message you pass to the constructor of the error
  const data = error.data; // This is optional, just to demonstrate how we could keep our original errors and pass to the frontend
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    const server = app.listen(8080);
    const io = initIO(server);
    io.on("connection", (socket) => {
      console.log("Client connected");
    });
  })
  .catch((err) => {
    console.log(err);
  });
