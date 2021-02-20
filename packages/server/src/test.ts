import { createServer } from ".";
import { IResolvers } from "@graphql-tools/utils/interfaces";

const todos = [
  {
    id: "A",
    content: "My demo todo from the server",
    author: "me"
  },
  {
    id: "B",
    content: "Another todo",
    author: "bob"
  },
  {
    id: "C",
    content: "And just another one",
    author: "kevin"
  }
];

const typeDefs = `
  type Todo {
    id: ID!
    content: String!
    author: String!
  }
  
  type Query {
    todos(id: ID!): [Todo!]!
  }
  
  type Mutation {
    addTodo(content: String!, author: String!): Boolean!
  }
`;

const resolvers: IResolvers = {
  Query: {
    todos(_, { id }) {
      return todos;
    }
  },
  Mutation: {
    addTodo(_, { content, author }) {
      todos.push({
        id: Math.random().toString(),
        content,
        author
      });
      return true;
    }
  }
};

const server = createServer({
  async context({ context }) {
    return context;
  },
  schema: {
    typeDefs,
    resolvers
  }
});

server.listen(8080);
