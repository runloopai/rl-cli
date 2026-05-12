import React from "react";
import { Devbox } from "@runloop/api-client";
import { clearScreen } from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";
import { getClient } from "../utils/client.js";

interface InteractivePtyProps {
  devboxId: string;
  sessionName: string;
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

type PtySessionHandle = {
  send(data: string | Uint8Array | ArrayBuffer | Buffer): void;
  resize(cols: number, rows: number): Promise<void>;
  close(): Promise<void>;
  waitForClose(): Promise<number | null>;
  output: AsyncIterable<string>;
};

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
  devboxId,
  sessionName,
  onExit,
  onError,
}) => {
  const sessionRef = React.useRef<PtySessionHandle | null>(null);
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
    let disposeIo: (() => void) | null = null;

    setImmediate(async () => {
      try {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;
        const devbox = Devbox.fromId(getClient() as any, devboxId) as any;

        const session = (await devbox.pty.open({
          sessionName,
          cols,
          rows,
        })) as PtySessionHandle;

        if (cancelled) {
          await session.close().catch(() => {});
          return;
        }

        sessionRef.current = session;
        disposeIo = startSdkPtyIoSession(session);

        if (cancelled) {
          disposeIo();
          await session.close().catch(() => {});
          return;
        }

        session
          .waitForClose()
          .then((code) => {
            sessionRef.current = null;
            disposeIo?.();
            restoreTerminal();
            hasStartedRef.current = false;
            onExitRef.current?.(code);
          })
          .catch((err: Error) => {
            sessionRef.current = null;
            disposeIo?.();
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
      disposeIo?.();
      sessionRef.current?.close().catch(() => {});
      sessionRef.current = null;
      restoreTerminal();
      hasStartedRef.current = false;
    };
  }, [devboxId, sessionName]);

  return null;
};

function startSdkPtyIoSession(session: PtySessionHandle): () => void {
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const onStdinData = (data: Buffer) => session.send(data);
  const onResize = () => {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    session.resize(cols, rows).catch(() => {});
  };

  process.stdin.on("data", onStdinData);
  process.on("SIGWINCH", onResize);

  let stopped = false;
  void (async () => {
    for await (const chunk of session.output) {
      if (stopped) break;
      process.stdout.write(chunk);
    }
  })();

  return () => {
    stopped = true;
    process.stdin.removeListener("data", onStdinData);
    process.removeListener("SIGWINCH", onResize);
    if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
      processUtils.stdin.setRawMode(false);
    }
    process.stdin.pause();
  };
}
