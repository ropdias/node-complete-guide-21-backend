const { buildSchema } = require("graphql");

// If you add "!" after the type you make it required (if the resolver do not return the type it will return an error)
// The types you create are usually very similar to your Mongoose models when you want to retrieve data like that
module.exports = buildSchema(`
  type Post {
    _id: ID!
    title: String!
    content: String!
    imageUrl: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    name: String!
    email: String!
    password: String
    status: String!
    posts: [Post!]!
  }

  input UserInputData {
    email: String!
    name: String!
    password: String!
  }

  type RootMutation {
    createUser(userInput: UserInputData): User!
  }

  schema {
    mutation: RootMutation
  }
`);
