const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization'); // Getting the request header 'Authorization'
  if (!authHeader) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }
  const token = authHeader.split(" ")[1];
  let decodedToken;
  try {
    // There is a jwt.decode() that only decode
    decodedToken = jwt.verify(token, process.env.JWT_SECRET); // this will decode it and check if it's valid
  } catch (err) {
    // This can fail so we are catching any errors here:
    err.statusCode = 500;
    throw err;
  }
  // This can be undefined if it didn't fail technically but it was unable to verify the token
  if (!decodedToken) {
    const error = new Error("Not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  // We will now store information from the token in our request that will be useful
  // later when we want to authorize access to for example deleting posts
  req.userId = decodedToken.userId;
  next();
};
