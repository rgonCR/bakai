export const iridescentColors = {
  violet: "#4600E8",
  blue: "#133EEB",
  magenta: "#C704D5",
  amber: "#FBB000",
} as const;

export const colors = {
  primary: "#0022FF",
  foreground: "#282828",
  surface: "#F3F5F8",
  spinnerTrack: "#D2D8FF",
} as const;

export const semanticColors = {
  canvas: "#EBEBED",
  panel: "#EDEDED",
  muted: "#5B5B5B",
  border: "#D9D9D9",
  white: "#FFFFFF",
} as const;

export const typography = {
  fontFamily: "var(--font-nunito), system-ui, sans-serif",
  sizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.375rem",
    "3xl": "1.875rem",
  },
  weights: {
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "900",
  },
} as const;

export const radii = {
  sm: "0.75rem",
  md: "1.25rem",
  lg: "1.875rem",
  full: "9999px",
} as const;

export const tailwindTokens = {
  primary: "ia-primary",
  foreground: "ia-foreground",
  surface: "ia-surface",
  canvas: "ia-canvas",
  muted: "ia-muted",
  border: "ia-border",
  panel: "ia-panel",
} as const;
