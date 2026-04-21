/**
 * AgentsObjectsMenuScreen - Agents & Objects sub-menu using navigation context
 */
import React from "react";
import { useNavigation, type ScreenName } from "../store/navigationStore.js";
import { AgentsObjectsMenu } from "../components/AgentsObjectsMenu.js";

export function AgentsObjectsMenuScreen() {
  const { navigate, goBack } = useNavigation();

  const handleSelect = (key: string) => {
    switch (key) {
      case "agents":
        navigate("agent-list");
        break;
      case "objects":
        navigate("object-list");
        break;
      case "axons":
        navigate("axon-list");
        break;
      default:
        navigate(key as ScreenName);
    }
  };

  return <AgentsObjectsMenu onSelect={handleSelect} onBack={goBack} />;
}
