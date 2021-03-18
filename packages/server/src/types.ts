import { Server as HttpServer } from "http";
import { ServerOptions as SocketServerOptions, Socket } from "socket.io";
import { ExecutionResult, GraphQLSchema } from "graphql";
import { IExecutableSchemaDefinition } from "@graphql-tools/schema/types";
import { Operation as PatchOperation } from "fast-json-patch";

export type ServerOptions<TContext = any> = {
  server?: HttpServer;
  socketOptions?: Partial<SocketServerOptions>;
  schema: GraphQLSchema | IExecutableSchemaDefinition;
  context?(payload: ContextPayload<TContext>): TContext | Promise<TContext>;
};

export type ContextPayload<TContext = any> = {
  socket: Socket;
  operation: Operation;
  clientContext: any;
  invalidate: InvalidateCallback<TContext>;
};

export type InvalidateCallback<TContext = any> = (
  queryField: string,
  partialArguments?: Record<string, any>,
  predicate?: (
    latestContext: TContext,
    latestResult: ExecutionResult
  ) => boolean
) => void;

export type OperationRecord<TContext = any> = {
  fields: Map<string, Record<string, any>>;
  latestContext: TContext;
  latestResult: ExecutionResult;
  execute(): void;
};

export type OperationPayload = {
  id: number;
  context: any;
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
