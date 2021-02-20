import React from "react";
import { gql, useQuery } from "urql";

const query = gql`
  query($id: ID!) @live {
    todos(id: $id) {
      id
      content
      author
    }
  }
`;

export default function App() {
  const [{ data, fetching, error }, refetch] = useQuery({
    query,
    variables: { id: "1" }
  });
  console.log({ data, fetching, error });
  return error ? (
    <h1>Error !</h1>
  ) : !data ? (
    <h1>Fetching...</h1>
  ) : (
    <>
      <h1>Todo List</h1>
      <ul>
        {data.todos.map((todo: any) => (
          <li key={todo.id}>
            {todo.content} (author: {todo.author})
          </li>
        ))}
      </ul>
    </>
  );
}
