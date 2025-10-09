import {
  shouldUseNonInteractiveOutput,
  outputData,
  outputResult,
  outputList,
  OutputOptions,
} from "@/utils/output";

describe("Output Utility", () => {
  describe("shouldUseNonInteractiveOutput", () => {
    it("should return true for json output", () => {
      const options: OutputOptions = { output: "json" };
      expect(shouldUseNonInteractiveOutput(options)).toBe(true);
    });

    it("should return true for yaml output", () => {
      const options: OutputOptions = { output: "yaml" };
      expect(shouldUseNonInteractiveOutput(options)).toBe(true);
    });

    it("should return true for text output", () => {
      const options: OutputOptions = { output: "text" };
      expect(shouldUseNonInteractiveOutput(options)).toBe(true);
    });

    it("should return false for interactive output", () => {
      const options: OutputOptions = { output: "interactive" };
      expect(shouldUseNonInteractiveOutput(options)).toBe(false);
    });

    it("should return false when output is undefined", () => {
      const options: OutputOptions = {};
      expect(shouldUseNonInteractiveOutput(options)).toBe(false);
    });

    it("should return false when output is empty string", () => {
      const options: OutputOptions = { output: "" };
      expect(shouldUseNonInteractiveOutput(options)).toBe(false);
    });
  });

  describe("outputData", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should output JSON format by default", () => {
      const testData = { id: "test", name: "test-name" };
      outputData(testData);
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));
    });

    it("should output JSON format when specified", () => {
      const testData = { id: "test", name: "test-name" };
      outputData(testData, "json");
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));
    });

    it("should output YAML format when specified", () => {
      const testData = { id: "test", name: "test-name" };
      outputData(testData, "yaml");
      
      expect(consoleSpy).toHaveBeenCalledWith("id: test\nname: test-name\n");
    });

    it("should output text format when specified", () => {
      const testData = { id: "test", name: "test-name" };
      outputData(testData, "text");
      
      expect(consoleSpy).toHaveBeenCalledWith("id: test\nname: test-name");
    });

    it("should handle arrays in text format", () => {
      const testData = ["item1", "item2", "item3"];
      outputData(testData, "text");
      
      expect(consoleSpy).toHaveBeenCalledWith("item1");
      expect(consoleSpy).toHaveBeenCalledWith("item2");
      expect(consoleSpy).toHaveBeenCalledWith("item3");
    });

    it("should handle nested objects in text format", () => {
      const testData = {
        id: "test",
        metadata: {
          key1: "value1",
          key2: "value2"
        }
      };
      outputData(testData, "text");
      
      expect(consoleSpy).toHaveBeenCalledWith("id: test\nmetadata: [object Object]");
    });
  });

  describe("outputResult", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should output result in non-interactive mode", () => {
      const result = { id: "test", status: "success" };
      const options: OutputOptions = { output: "json" };
      
      outputResult(result, options);
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
    });

    it("should not output result in interactive mode", () => {
      const result = { id: "test", status: "success" };
      const options: OutputOptions = {};
      
      outputResult(result, options);
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should output success message in interactive mode", () => {
      const result = { id: "test", status: "success" };
      const options: OutputOptions = {};
      const successMessage = "Operation completed successfully";
      
      outputResult(result, options, successMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith(successMessage);
    });
  });

  describe("outputList", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should output list in non-interactive mode", () => {
      const items = [
        { id: "item1", name: "Item 1" },
        { id: "item2", name: "Item 2" }
      ];
      const options: OutputOptions = { output: "json" };
      
      outputList(items, options);
      
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(items, null, 2));
    });

    it("should not output list in interactive mode", () => {
      const items = [
        { id: "item1", name: "Item 1" },
        { id: "item2", name: "Item 2" }
      ];
      const options: OutputOptions = {};
      
      outputList(items, options);
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
