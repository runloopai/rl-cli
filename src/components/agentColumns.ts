/**
 * Shared agent table column builder for interactive views.
 *
 * Wraps the data-layer `getAgentColumns()` with Table Column<Agent> styling
 * so the agent list screen, devbox create picker, and benchmark job create
 * picker all render agents consistently.
 */
import { createTextColumn, type Column } from "./Table.js";
import { getAgentColumns, type Agent } from "../services/agentService.js";
import { colors } from "../utils/theme.js";

/** Per-column styling overrides. Columns not listed use Table defaults. */
const columnStyles: Record<
  string,
  { color?: string; dimColor?: boolean; bold?: boolean }
> = {
  id: { color: colors.idColor, dimColor: false, bold: false },
  source: { color: colors.textDim, dimColor: false, bold: false },
  version: { color: colors.accent3, dimColor: false, bold: false },
  created: { color: colors.textDim, dimColor: false, bold: false },
};

// Space consumed by table chrome: borders (2) + selection pointer (2) + border paddingX (2)
const TABLE_CHROME = 6;

/**
 * Build Table Column<Agent>[] for a given terminal width.
 *
 * Accounts for table border/pointer chrome so columns fill the available
 * content area exactly. Pass as the `columns` prop to Table or ResourcePicker.
 */
export function buildAgentTableColumns(
  terminalWidth: number,
): Column<Agent>[] {
  const availableWidth = terminalWidth - TABLE_CHROME;
  const agentCols = getAgentColumns([], availableWidth);

  return agentCols.map((col) => {
    const style = columnStyles[col.key] ?? {};
    return createTextColumn<Agent>(
      col.key,
      col.label,
      (a: Agent) => col.getValue(a),
      { width: col.width, ...style },
    );
  });
}
