import { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { ExecutionResult } from "graphql";
import { Operation as PatchOperation } from "fast-json-patch";

export type ClientOptions<TContext = any> = {
  url?: string;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
  context?(payload: ContextPayload): TContext | Promise<TContext>;
};

export type ContextPayload = {
  socket: Socket;
  operation: Operation;
};

export type OperationRecord = {
  observer: ResultObserver;
  latestResult: ExecutionResult;
  execute(): void;
};

export type ResultObserver = {
  next?(result: ExecutionResult): void;
  error?(error: any): void;
  complete?(): void;
};

export type OperationPayload<TContext = any> = {
  id: number;
  context: TContext;
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
