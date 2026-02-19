/**
 * Scenario Service - Handles all scenario-related API calls
 */
import { getClient } from "../utils/client.js";
import type {
  ScenarioListParams,
  ScenarioView,
} from "@runloop/api-client/resources/scenarios/scenarios";

export type Scenario = ScenarioView;

export interface ListScenariosOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListScenariosResult {
  scenarios: Scenario[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List scenarios with pagination
 */
export async function listScenarios(
  options: ListScenariosOptions,
): Promise<ListScenariosResult> {
  const client = getClient();

  const queryParams: ScenarioListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  // Use name filter instead of search
  if (options.search) {
    queryParams.name = options.search;
  }

  const page = await client.scenarios.list(queryParams);
  const scenarios = page.scenarios || [];

  return {
    scenarios,
    totalCount: scenarios.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Get scenario by ID
 */
export async function getScenario(id: string): Promise<Scenario> {
  const client = getClient();
  return client.scenarios.retrieve(id);
}
