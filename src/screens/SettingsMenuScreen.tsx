/**
 * SettingsMenuScreen - Settings sub-menu using navigation context
 */
import React from "react";
import { useNavigation, type ScreenName } from "../store/navigationStore.js";
import { SettingsMenu } from "../components/SettingsMenu.js";

export function SettingsMenuScreen() {
  const { navigate, goBack } = useNavigation();

  const handleSelect = (key: string) => {
    switch (key) {
      case "network-policies":
        navigate("network-policy-list");
        break;
      case "gateway-configs":
        navigate("gateway-config-list");
        break;
      case "secrets":
        navigate("secret-list");
        break;
      default:
        // Fallback for any other screen names
        navigate(key as ScreenName);
    }
  };

  const handleBack = () => {
    goBack();
  };

  return <SettingsMenu onSelect={handleSelect} onBack={handleBack} />;
}
