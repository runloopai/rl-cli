import React from "react";
import WebSocket from "ws";
import {
  ptyConnect,
  ptyControl,
  buildWsUrl,
} from "../lib/pty-client.js";
import {
  showCursor,
  clearScreen,
  enterAlternateScreenBuffer,
} from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

interface InteractivePtyProps {
  baseUrl: string;
  sessionName: string;
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
  onExit,
  onError,
}) => {
  const wsRef = React.useRef<WebSocket | null>(null);
  const hasStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    releaseTerminal();

    let stdinListener: ((data: Buffer) => void) | null = null;
    let sigwinchListener: (() => void) | null = null;

    setImmediate(async () => {
      try {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;

        const connectResponse = await ptyConnect(baseUrl, sessionName, {
          cols,
          rows,
        });

        const wsUrl = buildWsUrl(baseUrl, connectResponse.connect_url);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.binaryType = "arraybuffer";

        ws.on("open", () => {
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
        });

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
          ptyControl(baseUrl, sessionName, {
            action: "resize",
            cols: newCols,
            rows: newRows,
          }).catch(() => {});
        };
        process.on("SIGWINCH", sigwinchListener);

        ws.on("close", (code: number) => {
          cleanup();
          restoreTerminal();
          hasStartedRef.current = false;
          onExit?.(code === 4000 ? 0 : code);
        });

        ws.on("error", (err: Error) => {
          cleanup();
          restoreTerminal();
          hasStartedRef.current = false;
          onError?.(err);
        });
      } catch (err) {
        restoreTerminal();
        hasStartedRef.current = false;
        onError?.(err instanceof Error ? err : new Error(String(err)));
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
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      restoreTerminal();
      hasStartedRef.current = false;
    };
  }, [baseUrl, sessionName, onExit, onError]);

  return null;
};
