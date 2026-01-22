/**
 * useListOperations - Reusable hook for handling operations in list views
 *
 * This hook solves the React state batching issue where setting state and immediately
 * calling a function that reads from that state doesn't work because the state
 * hasn't updated yet. Instead, we pass values directly to the execute function.
 */
import React from "react";

export interface OperationState<T> {
  /** The item currently being operated on */
  selectedItem: T | null;
  /** The operation currently being executed */
  executingOperation: string | null;
  /** Whether an operation is currently loading */
  isLoading: boolean;
  /** Success result message */
  result: string | null;
  /** Error from failed operation */
  error: Error | null;
}

export interface UseListOperationsOptions<T> {
  /**
   * Execute an operation on an item.
   * Return a success message string, or throw an error on failure.
   */
  onExecute: (item: T, operationKey: string, extra?: unknown) => Promise<string>;
  /** Optional callback after successful operation */
  onSuccess?: (operationKey: string) => void;
}

export interface UseListOperationsReturn<T> {
  /** Current operation state */
  state: OperationState<T>;
  /**
   * Execute an operation immediately.
   * This function takes the item and operation key directly to avoid state timing issues.
   */
  execute: (item: T, operationKey: string, extra?: unknown) => Promise<void>;
  /** Clear the result/error state and reset */
  clearResult: () => void;
  /** Set the selected item without executing (for multi-step operations like download prompts) */
  setSelectedItem: (item: T | null) => void;
  /** Set the executing operation name (for display purposes during multi-step operations) */
  setExecutingOperation: (operation: string | null) => void;
}

export function useListOperations<T>(
  options: UseListOperationsOptions<T>
): UseListOperationsReturn<T> {
  const { onExecute, onSuccess } = options;

  const [selectedItem, setSelectedItem] = React.useState<T | null>(null);
  const [executingOperation, setExecutingOperation] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const execute = React.useCallback(
    async (item: T, operationKey: string, extra?: unknown) => {
      // Set state for UI display purposes
      setSelectedItem(item);
      setExecutingOperation(operationKey);
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        // Execute with values passed directly (not from state)
        const successMessage = await onExecute(item, operationKey, extra);
        setResult(successMessage);
        onSuccess?.(operationKey);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [onExecute, onSuccess]
  );

  const clearResult = React.useCallback(() => {
    setResult(null);
    setError(null);
    setExecutingOperation(null);
    setSelectedItem(null);
  }, []);

  return {
    state: {
      selectedItem,
      executingOperation,
      isLoading,
      result,
      error,
    },
    execute,
    clearResult,
    setSelectedItem,
    setExecutingOperation,
  };
}
