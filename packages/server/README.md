# @graphql-live/server

Very tiny library to receive **live queries** from a compatible GraphQL client ([`@graphql-live/client`](https://www.npmjs.com/package/@graphql-live/client)), parse them using the `@live` directive and automatically send updates when fresh data is available. Under the hood, the server uses Socket.IO to communicate and sends JSON patches to perform surgical updates of previous results _(side note : you don't have to think about it)_, thus optimizing bandwidth usage.

## Install

```
yarn add @graphql-live/server
```

## Usage

It's very straightforward.
