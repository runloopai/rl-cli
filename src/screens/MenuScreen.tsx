/**
 * MenuScreen - Main menu using navigation context
 */
import React from "react";
import { useNavigation, type ScreenName } from "../store/navigationStore.js";
import { MainMenu } from "../components/MainMenu.js";

export function MenuScreen() {
  const { navigate } = useNavigation();

  const handleSelect = (key: string) => {
      switch (key) {
        case "devboxes":
          navigate("devbox-list");
          break;
        case "blueprints":
          navigate("blueprint-list");
          break;
        case "snapshots":
          navigate("snapshot-list");
          break;
        default:
          // Fallback for any other screen names
          navigate(key as ScreenName);
      }
  };

  return <MainMenu onSelect={handleSelect} />;
}
