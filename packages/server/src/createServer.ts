import { Server as HttpServer } from "http";
import {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
  Socket
} from "socket.io";
import { ExecutionResult, graphql, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { IExecutableSchemaDefinition } from "@graphql-tools/schema/types";

export type ServerOptions = {
  server?: HttpServer;
  socketOptions?: Partial<SocketServerOptions>;
  schema: GraphQLSchema | IExecutableSchemaDefinition;
  context?(payload: ContextPayload): any;
};

export type ContextPayload = {
  operation: Operation;
  context?: any;
  socket: Socket;
};

export type OperationRecord = {
  id: number;
  execute(): void;
};

export type OperationPayload = {
  id: number;
  context?: any;
  operation: Operation;
};

export type ResultPayload = {
  id: number;
  result: ExecutionResult;
  isFinal?: boolean;
};

export type Operation = {
  operation: string;
  operationName?: string | null;
  variables?: Record<string, any>;
};

export function createServer({
  server,
  socketOptions,
  schema,
  context
}: ServerOptions) {
  socketOptions = {
    cors: { origin: "*" },
    ...socketOptions
  };

  const io = server
    ? new SocketServer(server, socketOptions)
    : new SocketServer(socketOptions);

  const operations = new Map<Socket, Array<OperationRecord>>();

  const finalSchema =
    schema instanceof GraphQLSchema ? schema : makeExecutableSchema(schema);

  io.on("connection", (socket: Socket) => {
    console.log("Got new socket", socket.id);
    operations.set(socket, []);

    const onDisconnect = () => {
      operations.delete(socket);
    };

    const onOperation = ({
      id,
      context: clientContext,
      operation
    }: OperationPayload) => {
      const isLive = true; // Todo
      const record = {
        id,
        async execute() {
          const result = await graphql({
            schema: finalSchema,
            source: operation.operation,
            contextValue: await context?.({
              operation,
              context: clientContext,
              socket
            }),
            variableValues: operation.variables,
            operationName: operation.operationName
          });
          const payload: ResultPayload = {
            id,
            result,
            isFinal: !isLive
          };
          socket.emit("graphql:result", payload);
        }
      };
      if (isLive) operations.get(socket)?.push(record);
      void record.execute();
    };

    const onUnsubscribe = (id: number) => {
      const records = operations.get(socket);
      if (!records) return;
      operations.set(
        socket,
        records.filter(record => record.id !== id)
      );
    };

    socket.on("disconnect", onDisconnect);
    socket.on("graphql:operation", onOperation);
    socket.on("graphql:unsubscribe", onUnsubscribe);
  });

  return io;
}
