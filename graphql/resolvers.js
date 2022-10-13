const bcrypt = require("bcryptjs");

const User = require('../models/user');

module.exports = {
  // You need a method for every query/mutation you define in your schema
  // Here we define a method createUser because we have a mutation named createUser
  // args will be an object containing all the arguments passed to that function (We could also use destructuring like { userInput })
  // req is the request received
  // If you are not using async/await you need to return a Promise in the resolver, otherwise graphQL will not wait for it to resolve
  // When using async/await it's automatically returning a promise behind the scenes
  createUser: async ({ userInput }, req) => {
    // const email = args.userInput.email;
    // return User.findOne().then()
    const existingUser = await User.findOne({email: userInput.email})
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }
    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw
    })
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString()}; // We need to overwrite the _id converting it to a string
  }
}