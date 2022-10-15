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

  // If anything fails the image will still be saved in the server.
  // Obs: We are not checking if the image really was uploaded or not, because we can't control
  // that from here, only in the REST endpoint. So we are just saving in the DB the imageUrl that was
  // sent to the graphQL query without any validation, even if it was "undefined".
  createPost: async ({ postInput }, req) => {
    // Checking if the user is authenticated:
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
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
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("A user with this id could not be found.");
      error.code = 401;
      throw error;
    }
    const post = new Post({
      title: sanitizedTitle,
      content: sanitizedContent,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    // Add post to user posts
    user.posts.push(createdPost); // Here mongoose will do all the heavy lifting of pulling out the post ID and adding that to the user actually
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  posts: async ({ page }, req) => {
    // Checking if the user is authenticated:
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
    const currentPage = page || 1;
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .sort({ createdAt: -1 })
      .populate({ path: "creator", select: "name" }); // Using populate to get the name of the creator
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },
  post: async ({ id }, req) => {
    // Checking if the user is authenticated:
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate({
      path: "creator",
      select: "name",
    }); // Using populate to get the name of the creator;
    if (!post) {
      const error = new Error("Could not find post.");
      error.code = 404; // Not Found error
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  // If anything fails the image will still be saved in the server.
  // You should not try to delete the last image here in the resolver, because someone could send a graphql query directly
  // without really saving an image and in the DB you could have an image that is undefined or the path does not exist
  // Everything related to the imageUrl should be handled in the REST endpoint where you save the image in the backend
  updatePost: async ({ id, postInput }, req) => {
    // Checking if the user is authenticated:
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }

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

    const post = await Post.findById(id).populate({
      path: "creator",
      select: "name",
    }); // Using populate to get the name of the creator
    if (!post) {
      const error = new Error("Could not find post.");
      error.code = 404; // Not Found error
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized!");
      error.code = 403; // Forbidden
      throw error;
    }
    post.title = sanitizedTitle;
    post.content = sanitizedContent;
    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
};
