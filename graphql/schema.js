const { buildSchema } = require("graphql");

// If you add "!" after the type you make it required (if the resolver do not return the type it will return an error)
module.exports = buildSchema(`
  type TestData {
    text: String!
    views: Int!
  }

  type RootQuery {
    hello: TestData!
  }
  schema {
    query: RootQuery
  }
`);
