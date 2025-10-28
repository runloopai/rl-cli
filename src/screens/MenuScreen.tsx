/**
 * MenuScreen - Main menu using navigationStore
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { MainMenu } from "../components/MainMenu.js";

export const MenuScreen: React.FC = React.memo(() => {
  const navigate = useNavigationStore((state) => state.navigate);

  const handleSelect = React.useCallback(
    (key: string) => {
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
    },
    [navigate],
  );

  return <MainMenu onSelect={handleSelect} />;
});
