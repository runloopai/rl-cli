import React from "react";
import { render, Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { setApiKey } from "../utils/config.js";
import { Header } from "../components/Header.js";
import { Banner } from "../components/Banner.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { getSettingsUrl } from "../utils/url.js";
import { colors } from "../utils/theme.js";

const AuthUI = () => {
  const [apiKey, setApiKeyInput] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  useInput((input, key) => {
    if (key.return && apiKey.trim()) {
      setApiKey(apiKey.trim());
      setSaved(true);
      setTimeout(() => process.exit(0), 1000);
    }
  });

  if (saved) {
    return (
      <>
        <Banner />
        <Header title="Authentication" />
        <SuccessMessage
          message="API key saved!"
          details="Try: rli devbox list"
        />
      </>
    );
  }

  return (
    <Box flexDirection="column">
      <Banner />
      <Header title="Authentication" />
      <Box marginBottom={1}>
        <Text color={colors.textDim}>Get your key: </Text>
        <Text color={colors.primary}>{getSettingsUrl()}</Text>
      </Box>
      <Box>
        <Text color={colors.primary}>API Key: </Text>
        <TextInput
          value={apiKey}
          onChange={setApiKeyInput}
          placeholder="ak_..."
          mask="*"
        />
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textDim} dimColor>
          Press Enter to save
        </Text>
      </Box>
    </Box>
  );
};

export default function auth() {
  render(<AuthUI />);
}
