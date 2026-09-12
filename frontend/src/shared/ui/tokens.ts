/**
 * Design system tokens shared across buttons, badges, inputs, and containers.
 */

export const UI_RADII = {
  none: "",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

export type UiRadius = keyof typeof UI_RADII;
