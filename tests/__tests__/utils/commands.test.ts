import { createProgram } from "../../../src/utils/commands.js";

describe("command registration", () => {
  it("exposes only supported resource commands", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name()).sort()).toEqual([
      "agent",
      "axon",
      "blueprint",
      "devbox",
      "gateway-config",
      "mcp",
      "mcp-config",
      "mcp-server",
      "network-policy",
      "object",
      "secret",
      "snapshot",
    ]);
  });
});
