import React, { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "urql";

const todosQuery = gql`
  query($mainVarId: ID!) @live {
    todos(id: $mainVarId) {
      id
      content
      author
    }
  }
`;

const addTodoMutation = gql`
  mutation($content: String!, $author: String!) {
    addTodo(content: $content, author: $author)
  }
`;

export default function App() {
  const [content, setContent] = useState("");
  const [{ data, fetching, error }, refetch] = useQuery({
    query: todosQuery,
    variables: { mainVarId: "1" }
  });
  const [, addTodo] = useMutation(addTodoMutation);
  useEffect(() => {
    console.log({ data, fetching, error });
  }, [data, fetching, error]);
  return (
    <>
      {error ? (
        <h1>Error !</h1>
      ) : !data ? (
        <h1>Fetching...</h1>
      ) : (
        <>
          <h1>Todo List</h1>
          <button onClick={() => refetch({ requestPolicy: "network-only" })}>
            Refetch
          </button>
          <ul>
            {data.todos.map((todo: any) => (
              <li key={todo.id}>
                {todo.content} (author: {todo.author})
              </li>
            ))}
          </ul>
        </>
      )}
      <input value={content} onChange={e => setContent(e.target.value)} />
      <button onClick={() => addTodo({ content, author: "ostrebler" })}>
        Add
      </button>
    </>
  );
}
