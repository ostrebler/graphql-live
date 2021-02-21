import { ExecutionResult } from "graphql";
import { io, ManagerOptions, SocketOptions } from "socket.io-client";

export type ClientOptions = {
  url?: string;
  context?(operation: Operation): any;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
};

export type OperationRecord = {
  observer: ResultObserver;
  execute(): void;
};

export type ResultObserver = {
  next(value: ExecutionResult): void;
  error(error: any): void;
  complete(): void;
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

export function createClient({
  url,
  context,
  socketOptions
}: ClientOptions = {}) {
  const socket = url ? io(url, socketOptions) : io(socketOptions);
  let isOffline = false;
  let currentId = 0;
  const operations = new Map<number, OperationRecord>();

  const onConnect = () => {
    if (isOffline) {
      isOffline = false;
      for (const record of operations.values()) record.execute();
    }
  };

  const onDisconnect = () => {
    isOffline = true;
  };

  const onOperationResult = ({ id, result, isFinal }: ResultPayload) => {
    const record = operations.get(id);
    if (!record) return;
    record.observer.next(result);
    if (isFinal) {
      operations.delete(id);
      record.observer.complete();
    }
  };

  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  socket.on("graphql:result", onOperationResult);

  const destroy = () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("graphql:result", onOperationResult);
  };

  const execute = (operation: Operation, observer: ResultObserver) => {
    const id = currentId++;
    const record: OperationRecord = {
      observer,
      async execute() {
        const payload: OperationPayload = {
          id,
          context: await context?.(operation),
          operation
        };
        socket.emit("graphql:operation", payload);
      }
    };
    operations.set(id, record);
    void record.execute();
    return () => {
      socket.emit("graphql:unsubscribe", id);
      operations.delete(id);
      observer.complete();
    };
  };

  return {
    socket,
    execute,
    destroy
  };
}
