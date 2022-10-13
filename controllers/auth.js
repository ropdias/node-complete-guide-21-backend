const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed.");
    error.statusCode = 422;
    error.data = errors.array(); // This would allow us to keep my errors
    return next(error);
  }
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      email: email,
      password: hashedPassword,
      name: name,
    });
    const result = await user.save();
    res.status(201).json({ message: "User created!", userId: result._id }); // 201 Created
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("A user with this email could not be found.");
      error.statusCode = 401; // Unauthorized / Not Authenticated (Could be a 404 Not Found error)
      throw error; // catch() will catch this and forward with next()
    }
    loadedUser = user;
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Wrong password!");
      error.statusCode = 401; // Unauthorized / Not Authenticated (Could be a 404 Not Found error)
      throw error; // catch() will catch this and forward with next()
    }
    // Here we generate a JWT
    const token = jwt.sign(
      {
        email: loadedUser.email,
        userId: loadedUser._id.toString(),
      },
      process.env.JWT_SECRET, // Here is the secret key used for signin
      { expiresIn: "1h" } // Here we stablish the token will expire and be invalid in 1hour
    );
    res.status(200).json({ token: token, userId: loadedUser._id.toString() });
  } catch (err) {
    next(err);
  }
};
