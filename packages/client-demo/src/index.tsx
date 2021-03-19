import React from "react";
import ReactDOM from "react-dom";
import { createClient, dedupExchange, Provider } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { liveExchange } from "@graphql-live/client/dist/urql";
import App from "./App";

const client = createClient({
  url: "http://localhost:8080",
  exchanges: [
    dedupExchange,
    cacheExchange(),
    liveExchange({
      url: "http://localhost:8080",
      socketOptions: {
        path: "/api"
      },
      context() {
        return "mytoken";
      }
    })
  ]
});

ReactDOM.render(
  <Provider value={client}>
    <App />
  </Provider>,
  document.getElementById("root")
);
