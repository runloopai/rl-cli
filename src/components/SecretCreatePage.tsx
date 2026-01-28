/**
 * SecretCreatePage - Form for creating a new secret
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { FormTextInput, FormActionButton } from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface Secret {
  id: string;
  name: string;
}

interface SecretCreatePageProps {
  onBack: () => void;
  onCreate?: (secret: Secret) => void;
}

type FormField = "submit" | "name" | "value";

interface FormData {
  name: string;
  value: string;
}

export const SecretCreatePage = ({
  onBack,
  onCreate,
}: SecretCreatePageProps) => {
  const [currentField, setCurrentField] = React.useState<FormField>("submit");
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    value: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<Secret | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  const fields: Array<{
    key: FormField;
    label: string;
    type: "text" | "password" | "action";
  }> = [
    { key: "submit", label: "Create Secret", type: "action" },
    { key: "name", label: "Name (required)", type: "text" },
    { key: "value", label: "Value (required)", type: "password" },
  ];

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Main form input handler
  useInput((input, key) => {
    // Handle result screen
    if (result) {
      if (input === "q" || key.escape || key.return) {
        if (onCreate) {
          onCreate(result);
        } else {
          onBack();
        }
      }
      return;
    }

    // Handle error screen
    if (error) {
      if (input === "r" || key.return) {
        // Retry - clear error and return to form
        setError(null);
      } else if (input === "q" || key.escape) {
        // Quit - go back to list
        onBack();
      }
      return;
    }

    // Handle submitting state
    if (submitting) {
      return;
    }

    // Back to list
    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    // Submit form with Ctrl+S
    if (input === "s" && key.ctrl) {
      handleSubmit();
      return;
    }

    // Handle Enter on any field to submit
    if (key.return) {
      handleSubmit();
      return;
    }

    // Navigation between fields (up/down arrows and tab/shift+tab)
    if ((key.upArrow || (key.tab && key.shift)) && currentFieldIndex > 0) {
      setCurrentField(fields[currentFieldIndex - 1].key);
      return;
    }

    if (
      (key.downArrow || (key.tab && !key.shift)) &&
      currentFieldIndex < fields.length - 1
    ) {
      setCurrentField(fields[currentFieldIndex + 1].key);
      return;
    }
  });

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      setCurrentField("name");
      return;
    }
    if (!formData.value) {
      setValidationError("Value is required");
      setCurrentField("value");
      return;
    }

    setSubmitting(true);
    setError(null);
    setValidationError(null);

    try {
      const client = getClient();
      const secret = await client.secrets.create({
        name: formData.name.trim(),
        value: formData.value,
      });
      setResult(secret as Secret);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  };

  // Result screen
  if (result) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Create", active: true },
          ]}
        />
        <SuccessMessage message="Secret created successfully!" />
        <Box marginLeft={2} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={colors.textDim} dimColor>
              ID:{" "}
            </Text>
            <Text color={colors.idColor}>{result.id}</Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Name: {result.name}
            </Text>
          </Box>
        </Box>
        <Box marginTop={1} marginLeft={2}>
          <Text color={colors.info}>
            {figures.info} The secret value has been securely stored and cannot
            be retrieved.
          </Text>
        </Box>
        <NavigationTips
          tips={[{ key: "Enter/q/esc", label: "View secret details" }]}
        />
      </>
    );
  }

  // Error screen
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Create", active: true },
          ]}
        />
        <ErrorMessage message="Failed to create secret" error={error} />
        <NavigationTips
          tips={[
            { key: "Enter/r", label: "Retry" },
            { key: "q/esc", label: "Cancel" },
          ]}
        />
      </>
    );
  }

  // Submitting screen
  if (submitting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Create", active: true },
          ]}
        />
        <SpinnerComponent message="Creating secret..." />
      </>
    );
  }

  // Form screen
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Settings" },
          { label: "Secrets" },
          { label: "Create", active: true },
        ]}
      />

      <Box
        borderStyle="round"
        borderColor={colors.info}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <Text color={colors.info}>
          {figures.info} <Text bold>Note:</Text> Secret values are{" "}
          <Text bold>write-only</Text>. Once created, the value cannot be
          retrieved or viewed. To change a secret, delete it and create a new
          one.
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isActive = currentField === field.key;

          if (field.type === "action") {
            return (
              <FormActionButton
                key={field.key}
                label={field.label}
                isActive={isActive}
                hint="[Enter to create]"
              />
            );
          }

          if (field.type === "text") {
            const value = formData[field.key as keyof FormData] as string;
            const hasError = field.key === "name" && validationError === "Name is required";
            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(newValue) => {
                  setFormData({ ...formData, [field.key]: newValue });
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder="my-secret-name"
                error={hasError ? validationError : undefined}
              />
            );
          }

          if (field.type === "password") {
            const value = formData[field.key as keyof FormData] as string;
            const hasError = field.key === "value" && validationError === "Value is required";
            // Display masked value when not active
            const maskedValue = "*".repeat(value.length);
            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={isActive ? value : maskedValue}
                onChange={(newValue) => {
                  setFormData({ ...formData, [field.key]: newValue });
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder="Enter secret value"
                error={hasError ? validationError : undefined}
              />
            );
          }

          return null;
        })}
      </Box>

      <NavigationTips
        showArrows
        tips={[
          { key: "Enter", label: "Create" },
          { key: "q", label: "Cancel" },
        ]}
      />
    </>
  );
};
