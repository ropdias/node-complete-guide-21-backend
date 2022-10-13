const { validationResult } = require("express-validator");
const { unlink } = require("fs/promises");

const { getIO } = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = +req.query.page || 1;
  const perPage = 2;
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .sort({createdAt: -1})
      .populate({ path: "creator", select: "name" }); // Using populate to get the name of the creator

    res.status(200).json({
      message: "Fetched posts successfully.",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  const image = req.file; // Here you get an object from multer with information from the file uploaded (or undefined if rejected)
  if (!image) {
    const error = new Error("No image provided.");
    error.statusCode = 422; // Unprocessable Entity (Validation error)
    return next(error);
  }
  if (!errors.isEmpty()) {
    try {
      await unlink(image.path); // Deleting the image if the validation fails
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422; // Unprocessable Entity (Validation error)
      throw error; // catch() will catch this and forward with next()
    } catch (err) {
      return next(err);
    }
  }
  const imageUrl = image.path.replace("\\", "/"); // Getting the image path to store in the DB and fetch the image later
  const title = req.body.title;
  const content = req.body.content;
  // We don't need to add createdAt, mongoose will add automatically because of "timestamp: true"
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId, // This will be a string not an object but mongoose will convert it for us
  });
  try {
    await post.save();
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("A user with this id could not be found.");
      error.statusCode = 422; // Unprocessable Entity (Validation error)
      throw error; // catch() will catch this and forward with next()
    }
    user.posts.push(post); // Here mongoose will do all the heavy lifting of pulling out the post ID and adding that to the user actually
    await user.save();
    // await post.populate({ path: "creator", select: "name" }); // Using populate to get the name of the creator
    getIO().emit("posts", {
      action: "create",
      // Instead of using populate to get all the information from the creator we can directly get the information from post and create a new object
      post: { ...post._doc, creator: { _id: user._id, name: user.name } }, // Here we are sending the entire post._doc data and changing the creator
    });
    res.status(201).json({
      // 201 Created
      message: "Post created successfully!",
      post: post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId).populate({
      path: "creator",
      select: "name",
    }); // Using populate to get the name of the creator;
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404; // Not Found error
      throw error; // catch() will catch this and forward with next()
    }
    res.status(200).json({ message: "Post fetched.", post: post });
  } catch (err) {
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;
  const image = req.file;
  const updatedTitle = req.body.title;
  const updatedContent = req.body.content;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect.");
    error.statusCode = 422; // Unprocessable Entity (Validation error)
    if (image) {
      try {
        await unlink(image.path);
        throw error;
      } catch (err) {
        return next(err);
      }
    } else {
      return next(err);
    }
  }

  try {
    const post = await Post.findById(postId).populate({
      path: "creator",
      select: "name",
    }); // Using populate to get the name of the creator
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404; // Not Found error
      throw error; // catch() will catch this and forward with next()
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403; // Forbidden
      throw error;
    }
    post.title = updatedTitle;
    post.content = updatedContent;
    if (image) {
      await unlink(post.imageUrl);
      post.imageUrl = image.path.replace("\\", "/"); // Getting the image path to store in the DB and fetch the image later;
    }
    const result = await post.save();
    getIO().emit("posts", { action: "update", post: result });
    res.status(200).json({
      message: "Post updated!",
      post: result,
      creator: { _id: result.creator._id, name: result.creator.name },
    });
  } catch (err) {
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404; // Not Found error
      throw error; // catch() will catch this and forward with next()
    }
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403; // Forbidden
      throw error;
    }
    const promiseDeleteImage = unlink(post.imageUrl);
    const promiseDeletePost = Post.findByIdAndRemove(postId).then(() => {
      return User.updateOne({ _id: req.userId }, { $pull: { posts: postId } });
    });
    const results = await Promise.allSettled([
      promiseDeleteImage,
      promiseDeletePost,
    ]);
    if (
      results[0].status !== "fulfilled" &&
      results[1].status !== "fulfilled"
    ) {
      throw new Error("Deleting image and the post failed."); // catch() will catch this and forward with next()
    } else if (results[0].status !== "fulfilled") {
      throw new Error("Deleting image failed."); // catch() will catch this and forward with next()
    } else if (results[1].status !== "fulfilled") {
      throw new Error("Deleting post failed."); // catch() will catch this and forward with next()
    } else {
      getIO().emit("posts", { action: "delete", post: postId });
      res.status(200).json({ message: "Deleted post." });
    }
  } catch (err) {
    next(err);
  }
};

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("A user with this id could not be found.");
      error.statusCode = 422; // Unprocessable Entity (Validation error)
      throw error; // catch() will catch this and forward with next()
    }
    res.status(200).json({
      message: "Fetched status successfully.",
      status: user.status,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  const newStatus = req.body.status;
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("A user with this id could not be found.");
      error.statusCode = 422; // Unprocessable Entity (Validation error)
      throw error; // catch() will catch this and forward with next()
    }
    user.status = newStatus;
    await user.save();
    res.status(200).json({ message: "Status updated successfully!" });
  } catch (err) {
    next(err);
  }
};
