import React from "react";
import WebSocket from "ws";
import {
  ptyControl,
  createPtySessionReleaser,
  resolvePtyWebSocketUrl,
  buildWsHeaders,
  refreshPtySessionAfterAttach,
} from "../lib/pty-client.js";
import { openPtyWebSocket } from "../lib/pty-ws.js";
import {
  showCursor,
  clearScreen,
  enterAlternateScreenBuffer,
} from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

interface InteractivePtyProps {
  baseUrl: string;
  sessionName: string;
  authToken?: string;
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

function releaseTerminal(): void {
  process.stdin.pause();
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(false);
  }
  if (processUtils.stdout.isTTY) {
    processUtils.stdout.write("\x1b[0m");
  }
  showCursor();
}

function restoreTerminal(): void {
  clearScreen();
  enterAlternateScreenBuffer();
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(true);
  }
  process.stdin.resume();
}

export const InteractivePty: React.FC<InteractivePtyProps> = ({
  baseUrl,
  sessionName,
  authToken,
  onExit,
  onError,
}) => {
  const wsRef = React.useRef<WebSocket | null>(null);
  const hasStartedRef = React.useRef(false);
  const onExitRef = React.useRef(onExit);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onExitRef.current = onExit;
    onErrorRef.current = onError;
  });

  React.useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    releaseTerminal();

    let stdinListener: ((data: Buffer) => void) | null = null;
    let sigwinchListener: (() => void) | null = null;
    let releaseServerSession: (() => void) | null = null;

    setImmediate(async () => {
      try {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;

        const wsUrl = await resolvePtyWebSocketUrl(baseUrl, sessionName, {
          cols,
          rows,
          authToken,
        });
        const ws = await openPtyWebSocket(wsUrl, buildWsHeaders(authToken));
        wsRef.current = ws;

        await refreshPtySessionAfterAttach(
          ws,
          baseUrl,
          sessionName,
          cols,
          rows,
          authToken,
        );

        releaseServerSession = createPtySessionReleaser(
          baseUrl,
          sessionName,
          authToken,
        );

        ws.binaryType = "arraybuffer";

        if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
          processUtils.stdin.setRawMode(true);
        }
        process.stdin.resume();

        stdinListener = (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        };
        process.stdin.on("data", stdinListener);

        ws.on("message", (data: WebSocket.Data) => {
          if (data instanceof ArrayBuffer) {
            process.stdout.write(Buffer.from(data));
          } else if (Buffer.isBuffer(data)) {
            process.stdout.write(data);
          } else if (Array.isArray(data)) {
            process.stdout.write(Buffer.concat(data));
          } else {
            process.stdout.write(String(data));
          }
        });

        sigwinchListener = () => {
          const newCols = process.stdout.columns || 80;
          const newRows = process.stdout.rows || 24;
          ptyControl(
            baseUrl,
            sessionName,
            {
              action: "resize",
              cols: newCols,
              rows: newRows,
            },
            authToken,
          ).catch(() => {});
        };
        process.on("SIGWINCH", sigwinchListener);

        ws.on("close", (code: number) => {
          releaseServerSession?.();
          cleanup();
          restoreTerminal();
          hasStartedRef.current = false;
          onExitRef.current?.(code === 4000 ? 0 : code);
        });

        ws.on("error", (err: Error) => {
          releaseServerSession?.();
          cleanup();
          restoreTerminal();
          hasStartedRef.current = false;
          onErrorRef.current?.(err);
        });
      } catch (err) {
        restoreTerminal();
        hasStartedRef.current = false;
        onErrorRef.current?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    });

    function cleanup() {
      if (stdinListener) {
        process.stdin.removeListener("data", stdinListener);
        stdinListener = null;
      }
      if (sigwinchListener) {
        process.removeListener("SIGWINCH", sigwinchListener);
        sigwinchListener = null;
      }
    }

    return () => {
      cleanup();
      releaseServerSession?.();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      restoreTerminal();
      hasStartedRef.current = false;
    };
  }, [baseUrl, sessionName, authToken]);

  return null;
};
