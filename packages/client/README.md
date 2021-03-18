# @graphql-live/client

Very tiny library to send **live queries** to a compatible GraphQL server ([`@graphql-live/server`](https://www.npmjs.com/package/@graphql-live/server)) using the `@live` directive and automatically get updates when fresh data is available. Under the hood, the client uses Socket.IO to communicate and receives JSON patches to perform surgical updates of previous results _(side note : you don't have to think about it)_, thus optimizing bandwidth usage.

## Install

```
yarn add @graphql-live/client
```

## Usage

There are two ways to use this library :

- As a standalone, or
- As an add-on to your favorite GraphQL client library (Apollo, urql, etc.).

### As a standalone

You first have to create a client :

```javascript
import { createClient } from "@graphql-live/client";

const client = createClient({
  url: "http://localhost:8080"
});
```

This establishes a socket connection with the server at the given `url`. You can then execute (and subscribe to) a GraphQL operation using the [Observable pattern](https://github.com/tc39/proposal-observable) by calling `client.execute` :

```javascript
const operation = {
  operation: `
    query($id: ID!) {
      getUser(id: $id) {
        id
        name
        job
      }
    }
  `,
  variables: {
    id: "8dd870"
  }
};

// Option 1, by hand :
const observable = {
  subscribe: observer => ({
    unsubscribe: client.execute(operation, observer)
  })
};

// Option 2, with RxJS (could be another library as long as it implements the Observable pattern) :
const observable = Rx.Observable.create(observer =>
  client.execute(operation, observer)
);

// Then subscribe to results (this also sends the operation to the server) :
const subscription = observable.subscribe({
  next: result => doSomethingWith(result),
  complete: () => doAnotherThing()
});

// ...Finally, when you're no more interested in updates :
subscription.unsubscribe();
```

### As an add-on

Most GraphQL client libraries support add-on systems (Apollo's links, urql's exchanges, etc.). Currently, `@graphql-live/client` ships with two such add-ons :

1. `LiveLink` for Apollo :

   ```javascript
   import { ApolloClient, InMemoryCache } from "@apollo/client";
   import { LiveLink } from "@graphql-live/client/dist/apollo";

   const client = new ApolloClient({
     cache: new InMemoryCache(),
     link: new LiveLink({
       url: "http://localhost:8080"
     })
   });
   ```

2. `liveExchange` for urql :

   ```javascript
   import { createClient, dedupExchange } from "urql";
   import { cacheExchange } from "@urql/exchange-graphcache";
   import { liveExchange } from "@graphql-live/client/dist/urql";

   const client = createClient({
     url: "http://localhost:8080",
     exchanges: [
       dedupExchange,
       cacheExchange(),
       liveExchange({
         url: "http://localhost:8080"
       })
     ]
   });
   ```

### Custom context

You can add a custom `context` callback to your client config. It will be called right before an operation is sent to the server and it's return value can be used server-side to generate custom resolver context. This might typically be used to pass auth tokens.

```javascript
const client = createClient({
  url: "http://localhost:8080",
  exchanges: [
    dedupExchange,
    cacheExchange(),
    liveExchange({
      url: "http://localhost:8080",
      context() {
        return auth().currentUser.token;
      }
    })
  ]
});
```

## API

### `createClient`

```typescript
declare function createClient<TContext = any>({
  url,
  socketOptions,
  context
}?: ClientOptions<TContext>): {
  socket: Socket;
  destroy: () => void;
  execute: (operation: Operation, observer: ResultObserver) => () => void;
};
```

When you create a client, what you actually get back is an object containing the active socket, a `destroy` callback to release all listeners and disconnect the socket, and the `execute` function seen above.

### `LiveLink`

```typescript
declare class LiveLink<TContext = any> extends ApolloLink {
  constructor(options: ClientOptions<TContext>);
}
```

### `liveExchange`

```typescript
declare function liveExchange<TContext = any>(
  options: ClientOptions<TContext>
): Exchange;
```

### Types

```typescript
type ClientOptions<TContext = any> = {
  url?: string;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
  context?(payload: ContextPayload): TContext | Promise<TContext>;
};

type ContextPayload = {
  socket: Socket;
  operation: Operation;
};

type ResultObserver = {
  next?(value: ExecutionResult): void;
  error?(error: any): void;
  complete?(): void;
};

type Operation = {
  operation: string;
  operationName?: string | null;
  variables?: Record<string, any>;
};
```
