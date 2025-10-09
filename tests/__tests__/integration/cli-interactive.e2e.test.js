import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
const execAsync = promisify(exec);
describe("CLI Interactive Mode", () => {
    const CLI_PATH = "dist/cli.js";
    describe("Top-Level Commands Use Interactive Mode", () => {
        it("should trigger interactive mode for 'rln devbox'", async () => {
            const process = spawn("node", [CLI_PATH, "devbox"], {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000, // 5 second timeout
            });
            let output = "";
            let hasAlternateScreenBuffer = false;
            process.stdout.on("data", (data) => {
                output += data.toString();
                // Check for alternate screen buffer escape sequence
                if (data.toString().includes("\x1b[?1049h")) {
                    hasAlternateScreenBuffer = true;
                }
            });
            process.stderr.on("data", (data) => {
                output += data.toString();
            });
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    process.kill();
                    reject(new Error("Process timeout"));
                }, 5000);
                process.on("close", (code) => {
                    clearTimeout(timeout);
                    // Interactive mode should be triggered (alternate screen buffer)
                    expect(hasAlternateScreenBuffer).toBe(true);
                    resolve();
                });
                process.on("error", (error) => {
                    clearTimeout(timeout);
                    // If it's a raw mode error, that's expected in test environment
                    if (error.message.includes("Raw mode is not supported")) {
                        expect(hasAlternateScreenBuffer).toBe(true);
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                });
                // Send Ctrl+C to exit
                setTimeout(() => {
                    process.kill("SIGINT");
                }, 1000);
            });
        }, 10000);
        it("should trigger interactive mode for 'rln snapshot'", async () => {
            const process = spawn("node", [CLI_PATH, "snapshot"], {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000,
            });
            let hasAlternateScreenBuffer = false;
            process.stdout.on("data", (data) => {
                if (data.toString().includes("\x1b[?1049h")) {
                    hasAlternateScreenBuffer = true;
                }
            });
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    process.kill();
                    reject(new Error("Process timeout"));
                }, 5000);
                process.on("close", (code) => {
                    clearTimeout(timeout);
                    expect(hasAlternateScreenBuffer).toBe(true);
                    resolve();
                });
                process.on("error", (error) => {
                    clearTimeout(timeout);
                    if (error.message.includes("Raw mode is not supported")) {
                        expect(hasAlternateScreenBuffer).toBe(true);
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                });
                setTimeout(() => {
                    process.kill("SIGINT");
                }, 1000);
            });
        }, 10000);
        it("should trigger interactive mode for 'rln blueprint'", async () => {
            const process = spawn("node", [CLI_PATH, "blueprint"], {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000,
            });
            let hasAlternateScreenBuffer = false;
            process.stdout.on("data", (data) => {
                if (data.toString().includes("\x1b[?1049h")) {
                    hasAlternateScreenBuffer = true;
                }
            });
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    process.kill();
                    reject(new Error("Process timeout"));
                }, 5000);
                process.on("close", (code) => {
                    clearTimeout(timeout);
                    expect(hasAlternateScreenBuffer).toBe(true);
                    resolve();
                });
                process.on("error", (error) => {
                    clearTimeout(timeout);
                    if (error.message.includes("Raw mode is not supported")) {
                        expect(hasAlternateScreenBuffer).toBe(true);
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                });
                setTimeout(() => {
                    process.kill("SIGINT");
                }, 1000);
            });
        }, 10000);
    });
    describe("Subcommands Use Non-Interactive Mode", () => {
        it("should use non-interactive mode for 'rln devbox list'", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} devbox list`);
            // Should output JSON, not trigger interactive mode
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);
        it("should use non-interactive mode for 'rln snapshot list'", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} snapshot list`);
            // Should output JSON, not trigger interactive mode
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);
        it("should use non-interactive mode for 'rln blueprint list'", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} blueprint list`);
            // Should output JSON, not trigger interactive mode
            expect(() => JSON.parse(stdout)).not.toThrow();
        }, 10000);
    });
    describe("Backward Compatibility", () => {
        it("should maintain interactive mode for main menu (no args)", async () => {
            const process = spawn("node", [CLI_PATH], {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000,
            });
            let hasAlternateScreenBuffer = false;
            process.stdout.on("data", (data) => {
                if (data.toString().includes("\x1b[?1049h")) {
                    hasAlternateScreenBuffer = true;
                }
            });
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    process.kill();
                    reject(new Error("Process timeout"));
                }, 5000);
                process.on("close", (code) => {
                    clearTimeout(timeout);
                    expect(hasAlternateScreenBuffer).toBe(true);
                    resolve();
                });
                process.on("error", (error) => {
                    clearTimeout(timeout);
                    if (error.message.includes("Raw mode is not supported")) {
                        expect(hasAlternateScreenBuffer).toBe(true);
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                });
                setTimeout(() => {
                    process.kill("SIGINT");
                }, 1000);
            });
        }, 10000);
    });
    describe("Output Format Detection", () => {
        it("should detect JSON output format", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} devbox list`);
            const output = JSON.parse(stdout);
            expect(Array.isArray(output)).toBe(true);
        }, 10000);
        it("should detect text output format", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} devbox list -o text`);
            // Should not be JSON
            expect(() => JSON.parse(stdout)).toThrow();
            expect(stdout.trim()).not.toBe("");
        }, 10000);
        it("should detect YAML output format", async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} devbox list -o yaml`);
            // Should not be JSON
            expect(() => JSON.parse(stdout)).toThrow();
            expect(stdout.trim()).not.toBe("");
        }, 10000);
    });
});
