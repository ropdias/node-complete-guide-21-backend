const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");

module.exports = {
  // You need a method for every query/mutation you define in your schema
  // Here we define a method createUser because we have a mutation named createUser
  // args will be an object containing all the arguments passed to that function (We could also use destructuring like { userInput })
  // req is the request received
  // If you are not using async/await you need to return a Promise in the resolver, otherwise graphQL will not wait for it to resolve
  // When using async/await it's automatically returning a promise behind the scenes
  createUser: async ({ userInput }, req) => {
    // const email = args.userInput.email;

    // Sanitizers:
    const sanitizedEmail = validator.normalizeEmail(userInput.email);
    const sanitizedPassword = validator.trim(userInput.password);
    const sanitizedName = validator.trim(userInput.name);

    const errors = [];
    if (!validator.isEmail(sanitizedEmail)) {
      errors.push({ message: "Please enter a valid e-mail." });
    }
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      errors.push({
        message: "E-mail exists already, please pick a different one.",
      });
    }
    if (
      !validator.isLength(sanitizedPassword, { min: 5 }) ||
      !validator.isAlphanumeric(sanitizedPassword)
    ) {
      errors.push({ message: "Password too short!" });
    }
    if (validator.isEmpty(sanitizedName)) {
      errors.push({ message: "Name is empty!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const hashedPw = await bcrypt.hash(sanitizedPassword, 12);
    const user = new User({
      email: sanitizedEmail,
      name: sanitizedName,
      password: hashedPw,
    });
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() }; // We need to overwrite the _id converting it to a string
  },
  login: async ({ email, password }) => {
    // Sanitizers:
    const sanitizedEmail = validator.normalizeEmail(email);
    const sanitizedPassword = validator.trim(password);

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      const error = new Error("User not found!");
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(sanitizedPassword, user.password);
    if (!isEqual) {
      const error = new Error("Password is incorrect");
      error.code = 401;
      throw error;
    }
    // Here we generate a JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      process.env.JWT_SECRET, // Here is the secret key used for signin
      { expiresIn: "1h" } // Here we stablish the token will expire and be invalid in 1hour
    );
    return { token: token, userId: user._id.toString() };
  },
  createPost: async ({ postInput }, req) => {
    // Sanitizers:
    const sanitizedTitle = validator.trim(postInput.title);
    const sanitizedContent = validator.trim(postInput.content);

    const errors = [];
    if (!validator.isLength(sanitizedTitle, { min: 5 })) {
      errors.push({ message: "Title is invalid." });
    }
    if (!validator.isLength(sanitizedContent, { min: 5 })) {
      errors.push({ message: "Content is invalid." });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const post = new Post({
      title: sanitizedTitle,
      content: sanitizedContent,
      imageUrl: postInput.imageUrl,
      // creator: req.userId, // This will be a string not an object but mongoose will convert it for us
    });
    const createdPost = await post.save();
    // Add post to users posts
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
};
