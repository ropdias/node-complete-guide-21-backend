const path = require("path");
const { unlink } = require("fs/promises");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { graphqlHTTP } = require("express-graphql");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images"); // it means NO ERROR (null) and we will save in the folder named 'images'
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + "-" + file.originalname); // it means NO ERROR (null) and we will use the filename using a UUID + the original name
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true); // it means NO ERROR (null) and TRUE we are accepting that file
  } else {
    cb(null, false); // it means NO ERROR (null) and FALSE we are not accepting that file
  }
};

// Multer is a middleware for handling multipart/form-data
// Multer adds a body object and a file or files object to the request object.
// The body object contains the values of the text fields of the form
// the file or files object contains the files uploaded via the form.
// NOTE: Multer will not process any form which is not multipart (multipart/form-data)
const upload = multer({ storage: fileStorage, fileFilter: fileFilter });

app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

// The frontend is not handling when no image is provided yet, it is saving in the DB with imageUrl: undefined
// Check additional things that could go wrong in here based on the node-complete-guide-20 like needing to delete image
// if it didnt pass the validating in the resolver
app.put("/post-image", upload.single("image"), async (req, res, next) => {
  // Checking if the user is authenticated:
  if (!req.isAuth) {
    const error = new Error("Not authenticated!");
    error.code = 401;
    return next(error);
  }
  const image = req.file; // Here you get an object from multer with information from the file uploaded (or undefined if rejected)
  if (!image) {
    // We will use code 200 here because when we edit a post we can choose a new image or not.
    return res.status(200).json({ message: "No image provided!" });
  }
  try {
    if (req.body.oldPath) {
      await unlink(req.body.oldPath);
    }
    return res
      .status(201)
      .json({ message: "Image stored.", filePath: req.file.path.replace("\\", "/") });
  } catch (err) {
    next(err);
  }
});

// It's a convention to use /graphql
// Do not limit it to POST requests, we will use graphiql, a special tool to test your API (so we need GET request too)
app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true, // This is a special tool to test your API, you can remove in production
    customFormatErrorFn: (err) => {
      // err.originalError will be set by express-graphql when it detects and error throw in your code
      // either by you or some other third-party package. If you have a technical error,
      // lets say a missing character in your front-end query then it will not have the originalError.
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data; // This can be undefined for throw errors that don't set this parameter
      const message = err.message || "An Error occurred."; // This is already pulled out of the error by graphql.
      const code = err.originalError.code || 500;
      return { message: message, status: code, data: data }; // You can name all fields the way you want
    },
  })
);

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
    app.listen(8080);
  })
  .catch((err) => {
    console.log(err);
  });
