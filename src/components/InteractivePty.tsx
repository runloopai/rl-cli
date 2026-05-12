import React from "react";
import WebSocket from "ws";
import {
  createPtySessionReleaser,
  resolvePtyWebSocketUrl,
  refreshPtySessionAfterAttach,
  startPtyIoSession,
  PTY_NORMAL_CLOSE_CODE,
} from "../lib/pty-client.js";
import { openPtyWebSocket } from "../lib/pty-ws.js";
import { clearScreen } from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

interface InteractivePtyProps {
  baseUrl: string;
  sessionName: string;
  authToken?: string;
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

/**
 * Hand control of the terminal back to the PTY by pausing Ink's raw-mode input.
 * Called before opening the WebSocket so Ink doesn't race on stdin.
 */
function releaseTerminal(): void {
  process.stdin.pause();
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(false);
  }
  if (processUtils.stdout.isTTY) {
    processUtils.stdout.write("\x1b[0m");
  }
}

/**
 * Return the terminal to Ink after a PTY session ends.
 * Clears any residual PTY output and re-enables raw mode so Ink can
 * receive keyboard events again.
 */
function restoreTerminal(): void {
  clearScreen();
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

    let cancelled = false;
    let ioDispose: (() => void) | null = null;

    setImmediate(async () => {
      try {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;

        const wsUrl = await resolvePtyWebSocketUrl(baseUrl, sessionName, {
          cols,
          rows,
          authToken,
        });

        if (cancelled) return;

        const ws = await openPtyWebSocket(wsUrl, authToken);

        if (cancelled) {
          ws.close();
          return;
        }

        wsRef.current = ws;

        // Attach IO listeners before the refresh round-trip so server output
        // emitted during the ptyControl HTTP call is not dropped.
        const releaseServerSession = createPtySessionReleaser(
          baseUrl,
          sessionName,
          authToken,
        );
        const { dispose, done } = startPtyIoSession(
          ws,
          baseUrl,
          sessionName,
          authToken,
        );

        const ioCleanup = () => {
          dispose();
          releaseServerSession();
        };
        ioDispose = ioCleanup;

        if (cancelled) {
          ioCleanup();
          return;
        }

        await refreshPtySessionAfterAttach(
          ws,
          baseUrl,
          sessionName,
          cols,
          rows,
          authToken,
        );

        done
          .then((code) => {
            wsRef.current = null;
            ioCleanup();
            restoreTerminal();
            hasStartedRef.current = false;
            onExitRef.current?.(code === PTY_NORMAL_CLOSE_CODE ? 0 : code);
          })
          .catch((err: Error) => {
            wsRef.current = null;
            ioCleanup();
            restoreTerminal();
            hasStartedRef.current = false;
            onErrorRef.current?.(err);
          });
      } catch (err) {
        if (!cancelled) {
          restoreTerminal();
          hasStartedRef.current = false;
          onErrorRef.current?.(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }
    });

    return () => {
      cancelled = true;
      ioDispose?.();
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
