import { io, ManagerOptions, SocketOptions } from "socket.io-client";

export type ClientOptions = {
  url?: string;
  context?(operation: Operation): any;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
};

export type Operation = {
  operation: string;
  operationName?: string | null;
  variables?: { [key: string]: any };
};

export type ObserverLike<TOperationResult> = {
  next(value: TOperationResult): void;
  error(error: any): void;
  complete(): void;
};

export type OperationRecord<TOperationResult> = {
  observer: ObserverLike<TOperationResult>;
  execute(): void;
};

export function createClient<TOperationResult = unknown>({
  url,
  context,
  socketOptions
}: ClientOptions = {}) {
  const socket = url ? io(url, socketOptions) : io(socketOptions);
  let isOffline = false;
  let currentId = 0;
  const operations = new Map<number, OperationRecord<TOperationResult>>();

  const onDisconnect = () => {
    isOffline = true;
  };

  const onConnect = () => {
    if (isOffline) {
      isOffline = false;
      for (const record of operations.values()) record.execute();
    }
  };

  const onOperationResult = ({ id, isFinal, ...result }: any) => {
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

  const execute = (
    observer: ObserverLike<TOperationResult>,
    operation: Operation
  ) => {
    const id = currentId++;
    const record = {
      observer,
      async execute() {
        const ctx = await context?.(operation);
        socket.emit("graphql:operation", {
          id,
          context: ctx,
          ...operation
        });
      }
    };
    operations.set(id, record);
    record.execute();
    return () => {
      socket.emit("graphql:unsubscribe", { id });
      operations.delete(id);
      observer.complete();
    };
  };

  return {
    execute,
    destroy
  };
}
