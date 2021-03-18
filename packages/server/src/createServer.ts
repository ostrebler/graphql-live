import { Server as SocketServer, Socket } from "socket.io";
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
import { compare } from "fast-json-patch";
import {
  getFieldRecords,
  InvalidateCallback,
  isLiveOperation,
  isPartialMatch,
  OperationPayload,
  OperationRecord,
  ResultPayload,
  ServerOptions
} from ".";

export function createServer<TContext = any>({
  server,
  socketOptions,
  schema,
  context = ({ invalidate }) => ({ invalidate } as any)
}: ServerOptions<TContext>) {
  socketOptions = {
    cors: { origin: "*" },
    ...socketOptions
  };

  const io = server
    ? new SocketServer(server, socketOptions)
    : new SocketServer(socketOptions);

  // This stores all ongoing live queries from all the clients :
  const liveOperations = new Map<
    Socket,
    Map<number, OperationRecord<TContext>>
  >();

  const finalSchema =
    schema instanceof GraphQLSchema ? schema : makeExecutableSchema(schema);

  // This function is used to invalidate live queries, thus triggering re-execution and live updates.
  // It will typically be passed as context to the resolvers. "predicate" can be used as an additional filter
  // if the developer wants to update live queries based on context values and/or latest known results :
  const invalidate: InvalidateCallback<TContext> = (
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
    const liveOps = new Map<number, OperationRecord<TContext>>();
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
      const record: OperationRecord<TContext> = {
        fields,
        // record.latestContext is technically never used with this initial value, so it's safe :
        latestContext: undefined as never,
        latestResult: {},
        async execute() {
          // On each execution, save the latest known result (empty object if it's the first time) :
          const previousResult = record.latestResult;
          try {
            // The context might change between re-execution and these changes might affect results, so it's
            // recalculated (and saved) here :
            record.latestContext = await context({
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
      // Prevents clients from messing with the server's state (example : sending one live query, then
      // another non-live operation with the same id) :
      else liveOps.delete(id);
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
