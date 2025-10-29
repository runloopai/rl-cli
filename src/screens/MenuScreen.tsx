/**
 * MenuScreen - Main menu using navigation context
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
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
          navigate(key as any);
      }
  };

  return <MainMenu onSelect={handleSelect} />;
}
