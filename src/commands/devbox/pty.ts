import { Devbox } from "@runloop/api-client";
import { cliStatus } from "../../utils/cliStatus.js";
import { outputError } from "../../utils/output.js";
import { waitForReady } from "../../utils/ssh.js";
import { getClient } from "../../utils/client.js";
import { processUtils } from "../../utils/processUtils.js";

type PtyProcessHandle = {
  interrupt?: () => Promise<void>;
  close: () => Promise<void>;
};

type PtySessionHandle = {
  send(data: string | Uint8Array | ArrayBuffer | Buffer): void;
  resize(cols: number, rows: number): Promise<void>;
  close(): Promise<void>;
  waitForClose(): Promise<number | null>;
  output: AsyncIterable<string>;
};

/** SIGINT/SIGTERM → interrupt/close remote PTY; returns disposer. */
function registerPtyInterruptHandlers(
  handle: PtyProcessHandle,
): () => void {
  function dispose() {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
  }
  function onSigint() {
    void (handle.interrupt ? handle.interrupt() : handle.close()).catch(
      () => {},
    );
  }
  function onSigterm() {
    dispose();
    void handle.close().catch(() => {});
  }
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  return dispose;
}

interface PtyOptions {
  session?: string;
  command?: string;
  wait?: boolean;
  timeout?: string;
  pollInterval?: string;
  output?: string;
}

export async function ptyDevbox(devboxId: string, options: PtyOptions = {}) {
  try {
    if (options.wait !== false) {
      cliStatus(`Waiting for devbox ${devboxId} to be ready...`);
      const isReady = await waitForReady(
        devboxId,
        parseInt(options.timeout || "180"),
        parseInt(options.pollInterval || "3"),
      );
      if (!isReady) {
        outputError(`Devbox ${devboxId} is not ready. Please try again later.`);
      }
    }

    const devbox = Devbox.fromId(getClient() as any, devboxId) as any;
    const sessionName = options.session?.trim() || devboxId;

    if (options.command) {
      await execCommand(devbox, sessionName, options.command);
    } else {
      await interactiveSession(devbox, sessionName);
    }
  } catch (error) {
    outputError("Failed to start PTY session", error);
  }
}

const PTY_EXEC_TIMEOUT_MS = (() => {
  const v = parseInt(process.env.RUNLOOP_PTY_EXEC_TIMEOUT_MS || "0", 10);
  return isNaN(v) || v < 0 ? 0 : v;
})();

async function execCommand(
  devbox: any,
  sessionName: string,
  command: string,
): Promise<void> {
  const ptyProcess = await devbox.pty.exec(command, {
    sessionName,
    cols: 80,
    rows: 24,
    timeoutMs: PTY_EXEC_TIMEOUT_MS || undefined,
    onOutput: (chunk: string) => process.stdout.write(chunk),
  });
  const disposeSignals = registerPtyInterruptHandlers(ptyProcess);
  try {
    await ptyProcess.wait();
  } finally {
    disposeSignals();
  }
}

async function interactiveSession(
  devbox: any,
  sessionName: string,
): Promise<void> {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const session = (await devbox.pty.open({
    sessionName,
    cols,
    rows,
  })) as PtySessionHandle;

  const disposeIo = startSdkPtyIoSession(session);
  const disposeSignals = registerPtyInterruptHandlers(session);

  try {
    await session.waitForClose();
  } finally {
    disposeIo();
    disposeSignals();
    await session.close().catch(() => {});
  }
}

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
