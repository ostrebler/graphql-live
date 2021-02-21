import { Server as HttpServer } from "http";
import {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
  Socket
} from "socket.io";
import {
  DocumentNode,
  execute,
  ExecutionResult,
  getOperationAST,
  GraphQLError,
  GraphQLSchema,
  parse
} from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { IExecutableSchemaDefinition } from "@graphql-tools/schema/types";
import { getRootFieldRecords, isContained, isLiveOperation } from ".";

export type ServerOptions = {
  server?: HttpServer;
  socketOptions?: Partial<SocketServerOptions>;
  schema: GraphQLSchema | IExecutableSchemaDefinition;
  context?(payload: ContextPayload): any;
};

export type ContextPayload = {
  socket: Socket;
  operation: Operation;
  context?: any;
  invalidate: InvalidateCallback;
};

export type InvalidateCallback = {
  (
    rootField: string,
    partialArguments?: Record<string, any>,
    contextPredicate?: (context: any) => boolean
  ): void;
};

export type OperationRecord = {
  id: number;
  rootFields: Array<RootFieldRecord>;
  context: any;
  execute(): void;
};

export type RootFieldRecord = {
  name: string;
  arguments: Record<string, any>;
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

  const invalidate: InvalidateCallback = (
    rootField,
    partialArguments = {},
    contextPredicate = () => true
  ) => {
    for (const records of operations.values())
      for (const record of records) {
        const match =
          contextPredicate(record.context) &&
          record.rootFields.find(
            field =>
              rootField === field.name &&
              isContained(partialArguments, field.arguments)
          );
        if (match) record.execute();
      }
  };

  io.on("connection", (socket: Socket) => {
    operations.set(socket, []);

    const onDisconnect = () => {
      operations.delete(socket);
    };

    const onOperation = async ({
      id,
      context: clientContext,
      operation
    }: OperationPayload) => {
      let document: DocumentNode;

      const emitError = (error: GraphQLError) => {
        const payload: ResultPayload = {
          id,
          result: { errors: [error] },
          isFinal: true
        };
        socket.emit("graphql:result", payload);
      };

      try {
        document = parse(operation.operation);
      } catch (error) {
        emitError(error);
        return;
      }

      const mainOperation = getOperationAST(document, operation.operationName);
      if (!mainOperation) {
        emitError(new GraphQLError("No operation sent."));
        return;
      }

      const isLive = isLiveOperation(mainOperation);
      const rootFields = isLive
        ? getRootFieldRecords(mainOperation, operation.variables)
        : [];

      const record: OperationRecord = {
        id,
        rootFields,
        context: undefined,
        async execute() {
          record.context = !context
            ? { invalidate }
            : await context({
                socket,
                operation,
                context: clientContext,
                invalidate
              });
          const result = await execute({
            schema: finalSchema,
            document,
            contextValue: record.context,
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

      await record.execute();
      if (isLive) operations.get(socket)?.push(record);
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
