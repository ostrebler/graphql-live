import React from "react";
import { gql, useQuery } from "urql";

const query = gql`
  query($id: ID!) {
    todoList(id: $id) {
      id
      content
      author
    }
  }
`;

export default function App() {
  const [{ data, fetching, error }, refetch] = useQuery({ query });
  console.log({ data, fetching, error });
  return (
    <>
      <h1>Todo List</h1>
      <ul>
        <li>My todo</li>
      </ul>
    </>
  );
}
