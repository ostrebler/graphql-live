import { Server, ServerOptions as SocketOptions, Socket } from "socket.io";
import { Server as HttpServer } from "http";

export type ServerOptions = {
  server?: HttpServer;
  socketOptions?: Partial<SocketOptions>;
};

export function createServer({ server, socketOptions }: ServerOptions = {}) {
  const io = server
    ? new Server(server, socketOptions)
    : new Server(socketOptions);

  io.on("connection", (socket: Socket) => {
    console.log("Got new socket", socket.id);
  });
}
