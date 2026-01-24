/**
 * Utilities for reading secure input from stdin
 */

/**
 * Prompt for a secret value with masked input (shows * for each character)
 * Only works when stdin is a TTY (interactive terminal)
 */
export async function promptSecretValue(
  prompt = "Enter secret value: ",
): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (char: string) => {
      if (char === "\n" || char === "\r") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(0);
      } else if (char === "\u007F" || char === "\b") {
        // Backspace (0x7F) or Ctrl+H (0x08)
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (char >= " ") {
        // Only add printable characters
        value += char;
        process.stdout.write("*");
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Read all data from stdin (for piped input)
 */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString().trim();
}

/**
 * Get a secret value from either piped stdin or interactive prompt
 * Automatically detects whether input is piped or interactive
 */
export async function getSecretValue(
  prompt = "Enter secret value: ",
): Promise<string> {
  if (process.stdin.isTTY) {
    return promptSecretValue(prompt);
  } else {
    return readStdin();
  }
}
