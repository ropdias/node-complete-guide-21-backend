const path = require("path");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { graphqlHTTP } = require("express-graphql");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");

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
      const message = err.message || 'An Error occurred.'; // This is already pulled out of the error by graphql.
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
