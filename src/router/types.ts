/**
 * Router Types - Screen definitions and routing types
 */
import type { ComponentType } from "react";
import type { ScreenName, RouteParams } from "../store/navigationStore.js";

export type { ScreenName, RouteParams };

export interface ScreenComponent {
  name: ScreenName;
  component: ComponentType<Record<string, unknown>>;
  onEnter?: (params: RouteParams) => void;
  onLeave?: (params: RouteParams) => void;
}
