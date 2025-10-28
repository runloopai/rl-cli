/**
 * Router Types - Screen definitions and routing types
 */
import type { ScreenName, RouteParams } from "../store/navigationStore.js";

export type { ScreenName, RouteParams };

export interface ScreenComponent {
  name: ScreenName;
  component: React.ComponentType<any>;
  onEnter?: (params: RouteParams) => void;
  onLeave?: (params: RouteParams) => void;
}
