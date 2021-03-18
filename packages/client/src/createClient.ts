import { io } from "socket.io-client";
import { applyPatch, deepClone } from "fast-json-patch";
import {
  ClientOptions,
  Operation,
  OperationPayload,
  OperationRecord,
  ResultObserver,
  ResultPayload
} from ".";

export function createClient<TContext = any>({
  url,
  socketOptions,
  context = () => undefined as any
}: ClientOptions<TContext> = {}) {
  const socket = url ? io(url, socketOptions) : io(socketOptions);
  let disconnected = false;
  let currentId = 0;

  // This stores all ongoing operations waiting for results (possibly result streams) :
  const operations = new Map<number, OperationRecord>();

  const onConnect = () => {
    if (disconnected) {
      disconnected = false;
      // If this was a reconnection, re-execute all active operations, to be up-to-date :
      for (const record of operations.values()) record.execute();
    }
  };

  const onDisconnect = () => {
    disconnected = true;
  };

  const onOperationResult = ({ id, patch, isFinal }: ResultPayload) => {
    const record = operations.get(id);
    if (!record) return;
    // When a patch is sent by the server, apply it to the latest known result and send
    // the updated result to the observer :
    record.latestResult = applyPatch(
      deepClone(record.latestResult),
      patch
    ).newDocument;
    record.observer.next?.(record.latestResult);
    if (isFinal) {
      operations.delete(id);
      record.observer.complete?.();
    }
  };

  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  socket.on("graphql:result", onOperationResult);

  const destroy = () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("graphql:result", onOperationResult);
    socket.disconnect();
  };

  const execute = (operation: Operation, observer: ResultObserver) => {
    // For each new operation, a unique id is created :
    const id = currentId++;
    // Also, a record is added to the operation store, keeping track of the observer interested
    // in results, the latest known result, and a function to execute the operation (might be
    // used for re-executions on reconnections) :
    const record: OperationRecord = {
      observer,
      latestResult: {},
      async execute() {
        // The only cases where this function is called is on first execution or on re-execution.
        // Re-execution can be caused by the server going down or the connection being lost temporarily.
        // In all those cases, state will be set to {} on the server, so it needs to be in sync here :
        record.latestResult = {};
        const payload: OperationPayload<TContext> = {
          id,
          context: await context({ socket, operation }),
          operation
        };
        socket.emit("graphql:operation", payload);
      }
    };
    operations.set(id, record);
    record.execute();
    return () => {
      socket.emit("graphql:unsubscribe", id);
      operations.delete(id);
      observer.complete?.();
    };
  };

  return {
    socket,
    destroy,
    execute
  };
}
