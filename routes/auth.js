const express = require("express");
const { body } = require("express-validator");
const bodyParser = require("body-parser");

const User = require("../models/user");
const authController = require("../controllers/auth");

const router = express.Router();

router.put(
  "/signup",
  bodyParser.json(),
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid e-mail.")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject(
              "E-mail exists already, please pick a different one."
            );
          }
        });
      })
      .normalizeEmail(), // Sanitizer to normalize e-mail addresses
    body(
      "password",
      "Please enter a password with only numbers and text and at least 5 characters"
    )
      .trim() // Sanitizer to remove spaces
      .isLength({ min: 5 }) // This is just a demonstration, in production it should have more characters
      .isAlphanumeric(), // This is just a demonstration, in production we should allow special characters
    body("name")
      .trim() // Sanitizer to remove spaces
      .not() // To check if it's not empty
      .isEmpty(),
  ],
  authController.signup
);

// We could add validation to the email/password in the login but we will check the email/password pair in the DB anyways.
router.post("/login", bodyParser.json(), authController.login);

module.exports = router;
