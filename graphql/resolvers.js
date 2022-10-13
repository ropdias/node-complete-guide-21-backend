module.exports = {
  // You need a method for every query/mutation you define in your schema
  // Here we define a method hello because we have a query named hello
  hello: () => {
    return {
      text: 'Hello World',
      views: 1245
    };
  }
}