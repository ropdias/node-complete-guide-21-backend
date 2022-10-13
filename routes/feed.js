const express = require("express");
const { body } = require("express-validator");
const bodyParser = require("body-parser");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const feedController = require("../controllers/feed");
const isAuth = require("../middleware/is-auth");

const router = express.Router();

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

// GET /feed/posts
router.get("/posts", isAuth, feedController.getPosts);

// POST /feed/post
router.post(
  "/post",
  isAuth,
  upload.single("image"), // We will extract the body and a single file (single()) stored in some field named "image" in the incoming requests
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.createPost
);

router.get("/post/:postId", isAuth, feedController.getPost);

router.put(
  "/post/:postId",
  isAuth,
  upload.single("image"), // We will extract the body and a single file (single()) stored in some field named "image" in the incoming requests
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.updatePost
);

router.delete("/post/:postId", isAuth, feedController.deletePost);

router.get("/status", isAuth, feedController.getUserStatus);

router.patch(
  "/status",
  bodyParser.json(),
  isAuth,
  [body("status").trim().not().isEmpty()],
  feedController.updateUserStatus
);

module.exports = router;
