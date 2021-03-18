import { IResolvers } from "@graphql-tools/utils/interfaces";
import { createServer } from ".";

let todos = [
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
  directive @live on QUERY

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
    editTodo(id: ID!, content: String!): Todo!
    removeTodo(id: ID!): Boolean!
  }
`;

const resolvers: IResolvers = {
  Query: {
    todos(_, { id }) {
      return todos;
    }
  },
  Mutation: {
    addTodo(_, { content, author }, { invalidate }) {
      todos = [
        ...todos,
        {
          id: Math.random().toString(),
          content,
          author
        }
      ];
      invalidate("todos", { id: "1" });
      return true;
    },
    editTodo(_, { id, content }) {
      const todo = todos.find(todo => todo.id === id);
      if (!todo) throw new Error("No such todo found");
      todo.content = content;
      return todo;
    },
    removeTodo(_, { id }, { invalidate }) {
      todos = todos.filter(todo => todo.id !== id);
      invalidate("todos", { id: "1" });
      return true;
    }
  }
};

const server = createServer({
  async context({ clientContext, invalidate }) {
    return { clientContext, invalidate };
  },
  schema: {
    typeDefs,
    resolvers
  }
});

server.io.listen(8080);
