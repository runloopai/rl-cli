/**
 * FormListManager - List management component for forms (add/edit/delete items)
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { colors } from "../../utils/theme.js";

export interface FormListManagerProps {
  title: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  isActive: boolean;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  itemPlaceholder?: string;
  addLabel?: string;
  collapsedLabel?: string;
}

export const FormListManager = ({
  title,
  items,
  onItemsChange,
  isActive,
  isExpanded,
  onExpandedChange,
  itemPlaceholder = "item",
  addLabel = "+ Add new item",
  collapsedLabel = "items",
}: FormListManagerProps) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [inputMode, setInputMode] = React.useState<"add" | "edit" | null>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [editingIndex, setEditingIndex] = React.useState(-1);

  // Selection model: 0 = "Add new", 1..n = Existing items, n+1 = "Done"
  const maxIndex = items.length + 1;

  useInput(
    (input, key) => {
      if (!isExpanded) return;

      // Handle input mode (typing)
      if (inputMode) {
        if (key.return && inputValue.trim()) {
          if (inputMode === "add") {
            onItemsChange([...items, inputValue.trim()]);
          } else if (inputMode === "edit" && editingIndex >= 0) {
            const newItems = [...items];
            newItems[editingIndex] = inputValue.trim();
            onItemsChange(newItems);
          }
          setInputValue("");
          setInputMode(null);
          setEditingIndex(-1);
          setSelectedIndex(0);
          return;
        } else if (key.escape) {
          // Cancel input - restore item if editing
          if (inputMode === "edit" && editingIndex >= 0) {
            // Item was already removed, add it back
            const newItems = [...items];
            newItems.splice(editingIndex, 0, inputValue);
            onItemsChange(newItems);
          }
          setInputValue("");
          setInputMode(null);
          setEditingIndex(-1);
          return;
        }
        return;
      }

      // Navigation mode
      if (key.upArrow && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (key.downArrow && selectedIndex < maxIndex) {
        setSelectedIndex(selectedIndex + 1);
      } else if (key.return) {
        if (selectedIndex === 0) {
          // Add new
          setInputValue("");
          setInputMode("add");
        } else if (selectedIndex === maxIndex) {
          // Done - exit expanded mode
          onExpandedChange(false);
          setSelectedIndex(0);
        } else if (selectedIndex >= 1 && selectedIndex <= items.length) {
          // Edit existing (selectedIndex - 1 gives array index)
          const itemIndex = selectedIndex - 1;
          const itemToEdit = items[itemIndex];
          setInputValue(itemToEdit);
          setEditingIndex(itemIndex);
          // Remove the item while editing
          const newItems = items.filter((_, i) => i !== itemIndex);
          onItemsChange(newItems);
          setInputMode("edit");
        }
      } else if (
        (input === "d" || key.delete) &&
        selectedIndex >= 1 &&
        selectedIndex <= items.length
      ) {
        // Delete selected item
        const itemIndex = selectedIndex - 1;
        const newItems = items.filter((_, i) => i !== itemIndex);
        onItemsChange(newItems);
        // Adjust selection
        if (selectedIndex > newItems.length) {
          setSelectedIndex(Math.max(0, newItems.length));
        }
      } else if (key.escape || input === "q") {
        // Exit expanded mode
        onExpandedChange(false);
        setSelectedIndex(0);
      }
    },
    { isActive: isExpanded },
  );

  // Collapsed view
  if (!isExpanded) {
    return (
      <Box flexDirection="column" marginBottom={0}>
        <Box>
          <Text color={isActive ? colors.primary : colors.textDim}>
            {isActive ? figures.pointer : " "} {title}:{" "}
          </Text>
          <Text color={colors.text}>
            {items.length} {collapsedLabel}
          </Text>
          {isActive && (
            <Text color={colors.textDim} dimColor>
              {" "}
              [Enter to manage]
            </Text>
          )}
        </Box>
        {items.length > 0 && (
          <Box marginLeft={3} flexDirection="column">
            {items.slice(0, 3).map((item, idx) => (
              <Text key={idx} color={colors.textDim} dimColor>
                {figures.pointer} {item}
              </Text>
            ))}
            {items.length > 3 && (
              <Text color={colors.textDim} dimColor>
                ... and {items.length - 3} more
              </Text>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // Expanded view
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      paddingX={1}
      paddingY={1}
      marginBottom={1}
    >
      <Text color={colors.primary} bold>
        {figures.hamburger} {title}
      </Text>

      {/* Input form - shown when adding or editing */}
      {inputMode && (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="single"
          borderColor={inputMode === "add" ? colors.success : colors.warning}
          paddingX={1}
        >
          <Text
            color={inputMode === "add" ? colors.success : colors.warning}
            bold
          >
            {inputMode === "add" ? "Adding New" : "Editing"}
          </Text>
          <Box>
            <Text color={colors.primary}>Value: </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              placeholder={itemPlaceholder}
            />
          </Box>
        </Box>
      )}

      {/* Navigation menu - shown when not in input mode */}
      {!inputMode && (
        <>
          {/* Add new option */}
          <Box marginTop={1}>
            <Text color={selectedIndex === 0 ? colors.primary : colors.textDim}>
              {selectedIndex === 0 ? figures.pointer : " "}{" "}
            </Text>
            <Text
              color={selectedIndex === 0 ? colors.success : colors.textDim}
              bold={selectedIndex === 0}
            >
              {addLabel}
            </Text>
          </Box>

          {/* Existing items */}
          {items.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {items.map((item, index) => {
                const itemIndex = index + 1;
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Box key={index}>
                    <Text color={isSelected ? colors.primary : colors.textDim}>
                      {isSelected ? figures.pointer : " "}{" "}
                    </Text>
                    <Text
                      color={isSelected ? colors.primary : colors.textDim}
                      bold={isSelected}
                    >
                      {item}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Done option */}
          <Box marginTop={1}>
            <Text
              color={
                selectedIndex === maxIndex ? colors.primary : colors.textDim
              }
            >
              {selectedIndex === maxIndex ? figures.pointer : " "}{" "}
            </Text>
            <Text
              color={
                selectedIndex === maxIndex ? colors.success : colors.textDim
              }
              bold={selectedIndex === maxIndex}
            >
              {figures.tick} Done
            </Text>
          </Box>
        </>
      )}

      {/* Help text */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={colors.border}
        paddingX={1}
      >
        <Text color={colors.textDim} dimColor>
          {inputMode
            ? "[Enter] Save • [esc] Cancel"
            : `${figures.arrowUp}${figures.arrowDown} Navigate • [Enter] ${selectedIndex === 0 ? "Add" : selectedIndex === maxIndex ? "Done" : "Edit"} • [d] Delete • [esc] Back`}
        </Text>
      </Box>
    </Box>
  );
};
