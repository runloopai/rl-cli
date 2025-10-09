import { CommandExecutor } from "@/utils/CommandExecutor";
import { OutputOptions } from "@/utils/output";

// Mock the output functions
jest.mock("@/utils/output", () => ({
  shouldUseNonInteractiveOutput: jest.fn(),
  outputList: jest.fn(),
  outputResult: jest.fn(),
}));

// Mock the client
jest.mock("@/utils/client", () => ({
  getClient: jest.fn(() => ({
    devboxes: {
      list: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

// Mock ink render
jest.mock("ink", () => ({
  render: jest.fn(() => ({
    waitUntilExit: jest.fn(() => Promise.resolve()),
  })),
}));

import { shouldUseNonInteractiveOutput, outputList, outputResult } from "@/utils/output";

const mockShouldUseNonInteractiveOutput = shouldUseNonInteractiveOutput as jest.MockedFunction<typeof shouldUseNonInteractiveOutput>;
const mockOutputList = outputList as jest.MockedFunction<typeof outputList>;
const mockOutputResult = outputResult as jest.MockedFunction<typeof outputResult>;

describe("CommandExecutor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should set default output to json when none specified", () => {
      const executor = new CommandExecutor();
      expect(executor["options"].output).toBe("json");
    });

    it("should not override explicit output format", () => {
      const options: OutputOptions = { output: "yaml" };
      const executor = new CommandExecutor(options);
      expect(executor["options"].output).toBe("yaml");
    });

    it("should not override when output is explicitly undefined", () => {
      const options: OutputOptions = { output: undefined };
      const executor = new CommandExecutor(options);
      expect(executor["options"].output).toBe("json");
    });
  });

  describe("executeList", () => {
    it("should use non-interactive mode with default JSON output", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockFetchData = jest.fn().mockResolvedValue([{ id: "test" }]);
      const mockRenderUI = jest.fn();
      
      await executor.executeList(mockFetchData, mockRenderUI, 10);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockFetchData).toHaveBeenCalled();
      expect(mockOutputList).toHaveBeenCalledWith([{ id: "test" }], { output: "json" });
    });

    it("should use interactive mode when output is undefined", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(false);
      
      const executor = new CommandExecutor({});
      const mockFetchData = jest.fn().mockResolvedValue([{ id: "test" }]);
      const mockRenderUI = jest.fn();
      
      await executor.executeList(mockFetchData, mockRenderUI, 10);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockFetchData).not.toHaveBeenCalled();
      expect(mockOutputList).not.toHaveBeenCalled();
    });

    it("should limit results in non-interactive mode", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockFetchData = jest.fn().mockResolvedValue([
        { id: "test1" },
        { id: "test2" },
        { id: "test3" },
        { id: "test4" },
        { id: "test5" }
      ]);
      const mockRenderUI = jest.fn();
      
      await executor.executeList(mockFetchData, mockRenderUI, 3);
      
      expect(mockOutputList).toHaveBeenCalledWith([
        { id: "test1" },
        { id: "test2" },
        { id: "test3" }
      ], { output: "json" });
    });

    it("should handle errors in non-interactive mode", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockFetchData = jest.fn().mockRejectedValue(new Error("Test error"));
      const mockRenderUI = jest.fn();
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const processSpy = jest.spyOn(process, "exit").mockImplementation();
      
      await executor.executeList(mockFetchData, mockRenderUI, 10);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(processSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe("executeAction", () => {
    it("should use non-interactive mode with default JSON output", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockPerformAction = jest.fn().mockResolvedValue({ id: "test", status: "success" });
      const mockRenderUI = jest.fn();
      
      await executor.executeAction(mockPerformAction, mockRenderUI);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockPerformAction).toHaveBeenCalled();
      expect(mockOutputResult).toHaveBeenCalledWith(
        { id: "test", status: "success" },
        { output: "json" }
      );
    });

    it("should use interactive mode when output is undefined", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(false);
      
      const executor = new CommandExecutor({});
      const mockPerformAction = jest.fn().mockResolvedValue({ id: "test", status: "success" });
      const mockRenderUI = jest.fn();
      
      await executor.executeAction(mockPerformAction, mockRenderUI);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockPerformAction).not.toHaveBeenCalled();
      expect(mockOutputResult).not.toHaveBeenCalled();
    });

    it("should handle errors in non-interactive mode", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockPerformAction = jest.fn().mockRejectedValue(new Error("Test error"));
      const mockRenderUI = jest.fn();
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const processSpy = jest.spyOn(process, "exit").mockImplementation();
      
      await executor.executeAction(mockPerformAction, mockRenderUI);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(processSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe("executeDelete", () => {
    it("should use non-interactive mode with default JSON output", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockPerformDelete = jest.fn().mockResolvedValue(undefined);
      const mockRenderUI = jest.fn();
      
      await executor.executeDelete(mockPerformDelete, "test-id", mockRenderUI);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockPerformDelete).toHaveBeenCalled();
      expect(mockOutputResult).toHaveBeenCalledWith(
        { id: "test-id", status: "deleted" },
        { output: "json" }
      );
    });

    it("should use interactive mode when output is undefined", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(false);
      
      const executor = new CommandExecutor({});
      const mockPerformDelete = jest.fn().mockResolvedValue(undefined);
      const mockRenderUI = jest.fn();
      
      await executor.executeDelete(mockPerformDelete, "test-id", mockRenderUI);
      
      expect(mockShouldUseNonInteractiveOutput).toHaveBeenCalledWith({ output: "json" });
      expect(mockPerformDelete).not.toHaveBeenCalled();
      expect(mockOutputResult).not.toHaveBeenCalled();
    });

    it("should handle errors in non-interactive mode", async () => {
      mockShouldUseNonInteractiveOutput.mockReturnValue(true);
      
      const executor = new CommandExecutor();
      const mockPerformDelete = jest.fn().mockRejectedValue(new Error("Test error"));
      const mockRenderUI = jest.fn();
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const processSpy = jest.spyOn(process, "exit").mockImplementation();
      
      await executor.executeDelete(mockPerformDelete, "test-id", mockRenderUI);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(processSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe("fetchFromIterator", () => {
    it("should fetch items from iterator with limit", async () => {
      const executor = new CommandExecutor();
      
      const mockIterator = async function* () {
        yield { id: "item1" };
        yield { id: "item2" };
        yield { id: "item3" };
        yield { id: "item4" };
        yield { id: "item5" };
      };
      
      const result = await executor.fetchFromIterator(mockIterator(), { limit: 3 });
      
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { id: "item1" },
        { id: "item2" },
        { id: "item3" }
      ]);
    });

    it("should apply filter when provided", async () => {
      const executor = new CommandExecutor();
      
      const mockIterator = async function* () {
        yield { id: "item1", status: "active" };
        yield { id: "item2", status: "inactive" };
        yield { id: "item3", status: "active" };
        yield { id: "item4", status: "inactive" };
      };
      
      const result = await executor.fetchFromIterator(
        mockIterator(),
        { 
          limit: 10,
          filter: (item: any) => item.status === "active"
        }
      );
      
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { id: "item1", status: "active" },
        { id: "item3", status: "active" }
      ]);
    });
  });
});
