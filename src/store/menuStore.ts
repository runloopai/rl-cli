import { create } from "zustand";

interface MenuState {
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  settingsSelectedKey: string;
  setSettingsSelectedKey: (key: string) => void;
  agentsObjectsSelectedKey: string;
  setAgentsObjectsSelectedKey: (key: string) => void;
  benchmarkSelectedKey: string;
  setBenchmarkSelectedKey: (key: string) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  selectedKey: "devboxes",
  setSelectedKey: (key) => set({ selectedKey: key }),
  settingsSelectedKey: "network-policies",
  setSettingsSelectedKey: (key) => set({ settingsSelectedKey: key }),
  agentsObjectsSelectedKey: "agents",
  setAgentsObjectsSelectedKey: (key) => set({ agentsObjectsSelectedKey: key }),
  benchmarkSelectedKey: "benchmarks",
  setBenchmarkSelectedKey: (key) => set({ benchmarkSelectedKey: key }),
}));
