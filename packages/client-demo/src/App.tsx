import React, { useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "urql";

const todoFragment = gql`
  fragment Todo on Todo {
    id
    content
    author
  }
`;

const todosQuery = gql`
  ${todoFragment}

  query($listId: ID!) @live {
    todos(id: $listId) {
      ...Todo
    }
  }
`;

const addTodoMutation = gql`
  mutation($content: String!, $author: String!) {
    addTodo(content: $content, author: $author)
  }
`;

const editTodoMutation = gql`
  ${todoFragment}

  mutation($id: ID!, $content: String!) {
    editTodo(id: $id, content: $content) {
      ...Todo
    }
  }
`;

const removeTodoMutation = gql`
  mutation($id: ID!) {
    removeTodo(id: $id)
  }
`;

export default function App() {
  const [content, setContent] = useState("");
  const [, addTodo] = useMutation(addTodoMutation);
  const [{ data, fetching, error }, refetch] = useQuery({
    query: todosQuery,
    variables: { listId: "1" }
  });

  useEffect(() => {
    console.log({ data, fetching, error });
  }, [data, fetching, error]);

  return (
    <>
      {error ? (
        <h1>Error ! {error.message}</h1>
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
              <Todo key={todo.id} todo={todo} />
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

function Todo({ todo }: any) {
  const [content, setContent] = useState(todo.content);
  const [, editTodo] = useMutation(editTodoMutation);
  const [, removeTodo] = useMutation(removeTodoMutation);
  return (
    <li key={todo.id}>
      {todo.content} (author: {todo.author}){" "}
      <input value={content} onChange={e => setContent(e.target.value)} />
      <button onClick={() => editTodo({ id: todo.id, content })}>Edit</button>
      <button onClick={() => removeTodo({ id: todo.id })}>Remove</button>
    </li>
  );
}
