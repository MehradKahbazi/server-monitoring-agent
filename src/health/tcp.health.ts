import net from "node:net";

export interface TcpStatus {
  host: string;
  port: number;
  healthy: boolean;
  responseTimeMs: number | null;
  error?: string;
}

export async function checkTcp(
  host: string,
  port: number,
  timeoutMs = 5_000,
): Promise<TcpStatus> {
  const started = performance.now();

  return new Promise((resolve) => {
    const socket = net.createConnection({
      host,
      port,
    });

    let settled = false;

    const finish = (result: TcpStatus): void => {
      if (settled) {
        return;
      }

      settled = true;

      socket.destroy();

      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      finish({
        host,
        port,
        healthy: true,
        responseTimeMs: Math.round(performance.now() - started),
      });
    });

    socket.once("timeout", () => {
      finish({
        host,
        port,
        healthy: false,
        responseTimeMs: Math.round(performance.now() - started),
        error: "Connection timeout",
      });
    });

    socket.once("error", (error) => {
      finish({
        host,
        port,
        healthy: false,
        responseTimeMs: Math.round(performance.now() - started),
        error: error.message,
      });
    });
  });
}
