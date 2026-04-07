import { create } from "zustand";

interface MenuState {
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  settingsSelectedKey: string;
  setSettingsSelectedKey: (key: string) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  selectedKey: "devboxes",
  setSelectedKey: (key) => set({ selectedKey: key }),
  settingsSelectedKey: "network-policies",
  setSettingsSelectedKey: (key) => set({ settingsSelectedKey: key }),
}));
