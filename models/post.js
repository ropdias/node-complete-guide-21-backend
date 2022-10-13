const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    creator: {
      type: Schema.Types.ObjectId, // Connecting posts and Users
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// mongoose.model(): The first argument is the singular name of the collection your model is for.
// Mongoose automatically looks for the plural, lowercased version of your model name.
// Thus, for the example above, the model Post is for the posts collection in the database.
module.exports = mongoose.model("Post", postSchema);
