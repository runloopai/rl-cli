import { create } from "zustand";

interface MenuState {
  selectedKey: string;
  setSelectedKey: (key: string) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  selectedKey: "devboxes",
  setSelectedKey: (key) => set({ selectedKey: key }),
}));
