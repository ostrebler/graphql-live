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
  parse,
  validate
} from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { IExecutableSchemaDefinition } from "@graphql-tools/schema/types";
import { compare, Operation as PatchOperation } from "fast-json-patch";
import { getFieldRecords, isLiveOperation, isPartialMatch } from ".";

export type ServerOptions = {
  server?: HttpServer;
  socketOptions?: Partial<SocketServerOptions>;
  schema: GraphQLSchema | IExecutableSchemaDefinition;
  context?(payload: ContextPayload): any;
};

export type ContextPayload = {
  socket: Socket;
  operation: Operation;
  clientContext?: any;
  invalidate: InvalidateCallback;
};

export type InvalidateCallback<TContext = any, TData = Record<string, any>> = {
  (
    queryField: string,
    partialArguments?: Record<string, any>,
    predicate?: (
      latestContext: TContext,
      latestResult: ExecutionResult<TData>
    ) => boolean
  ): void;
};

export type OperationRecord = {
  fields: Map<string, Record<string, any>>;
  latestContext: any;
  latestResult: ExecutionResult;
  execute(): void;
};

export type OperationPayload = {
  id: number;
  context?: any;
  operation: Operation;
};

export type ResultPayload = {
  id: number;
  patch: Array<PatchOperation>;
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

  // This stores all ongoing live queries from all the clients :
  const liveOperations = new Map<Socket, Map<number, OperationRecord>>();

  const finalSchema =
    schema instanceof GraphQLSchema ? schema : makeExecutableSchema(schema);

  // This function is used to invalidate live queries, thus triggering re-execution and live updates.
  // It will typically be passed as context to the resolvers. "predicate" can be used as an additional filter
  // if the developer wants to update live queries based on context values and/or latest known results :
  const invalidate: InvalidateCallback = (
    queryField,
    partialArguments = {},
    predicate = () => true
  ) => {
    for (const liveOps of liveOperations.values())
      for (const record of liveOps.values()) {
        const args = record.fields.get(queryField);
        if (
          args &&
          isPartialMatch(partialArguments, args) &&
          predicate(record.latestContext, record.latestResult)
        )
          record.execute();
      }
  };

  const onConnection = (socket: Socket) => {
    const liveOps = new Map<number, OperationRecord>();
    liveOperations.set(socket, liveOps);

    const onDisconnect = () => {
      liveOperations.delete(socket);
    };

    const onOperation = async ({
      id,
      context: clientContext,
      operation
    }: OperationPayload) => {
      // This callback is used to emit a final error and to end the live subscription (if there was any) :
      const emitFinalError = (
        errors: ReadonlyArray<GraphQLError>,
        previousResult: ExecutionResult = {}
      ) => {
        const payload: ResultPayload = {
          id,
          patch: compare(previousResult, { errors }),
          isFinal: true
        };
        socket.emit("graphql:result", payload);
        liveOps.delete(id);
      };

      let document: DocumentNode;
      try {
        // The incoming operation is first parsed... :
        document = parse(operation.operation);
      } catch (error) {
        return emitFinalError([error]);
      }

      // ...then validated against the schema :
      const validationErrors = validate(finalSchema, document);
      if (validationErrors.length) return emitFinalError(validationErrors);

      // The main operation is retrieved from the document :
      const mainOperation = getOperationAST(document, operation.operationName);
      if (!mainOperation)
        return emitFinalError([new GraphQLError("No operation sent")]);

      // The query fields and arguments are retrieved if the main operation is a live query :
      const isLive = isLiveOperation(mainOperation);
      const fields = isLive
        ? getFieldRecords(mainOperation, operation.variables)
        : new Map<string, Record<string, any>>();

      // A record is created (and added to the live query store if there's a live query). The record keeps
      // track of the live query fields, the latest calculated context (it's recalculated on re-execution),
      // the latest known result and a function to execute the operation (might be used after invalidation) :
      const record: OperationRecord = {
        fields,
        latestContext: undefined,
        latestResult: {},
        async execute() {
          // On each execution, save the latest known result (empty object if it's the first time) :
          const previousResult = record.latestResult;
          try {
            // The context might change between re-execution and these changes might affect results, so it's
            // recalculated (and saved) here :
            record.latestContext = !context
              ? { invalidate }
              : await context({
                  socket,
                  operation,
                  clientContext,
                  invalidate
                });
            // Execute the GraphQL :
            record.latestResult = await execute({
              schema: finalSchema,
              document,
              contextValue: record.latestContext,
              variableValues: operation.variables,
              operationName: operation.operationName
            });
            // A patch is finally calculated between the old and the new result and sent to the client :
            const payload: ResultPayload = {
              id,
              patch: compare(previousResult, record.latestResult),
              isFinal: !isLive
            };
            isLive &&
              console.log("Patching ", JSON.stringify(payload.patch, null, 2));
            socket.emit("graphql:result", payload);
          } catch (error) {
            // If an error was thrown, it's either in context calculation or graphql execution. In either
            // case, it means fatal error with no partial data, thus live subscription is canceled :
            emitFinalError(
              [
                error instanceof GraphQLError
                  ? error
                  : error instanceof Error
                  ? new GraphQLError(error.message)
                  : new GraphQLError("Unknown error")
              ],
              previousResult
            );
          }
        }
      };

      if (isLive) liveOps.set(id, record);
      record.execute();
    };

    const onUnsubscribe = (id: number) => {
      // When the client is no more interested in live updates for operation {id} :
      liveOps.delete(id);
    };

    socket.on("disconnect", onDisconnect);
    socket.on("graphql:operation", onOperation);
    socket.on("graphql:unsubscribe", onUnsubscribe);
  };

  io.on("connection", onConnection);

  const destroy = () => {
    io.off("connection", onConnection);
    io.close();
    liveOperations.clear();
  };

  return {
    io,
    destroy
  };
}
