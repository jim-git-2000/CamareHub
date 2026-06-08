import type { CSSProperties } from "react";

export type StatCardTone = "totalValue" | "cameraCount" | "lensCount" | "filmStock";

type ToneStyle = {
  style: CSSProperties;
  iconStyle: CSSProperties;
};

export const statCardStyles: Record<StatCardTone, ToneStyle> = {
  totalValue: {
    style: { backgroundColor: "var(--stat-total-bg)", borderColor: "var(--stat-total-border)", color: "var(--stat-total-fg)" },
    iconStyle: { color: "var(--stat-total-icon)" }
  },
  cameraCount: {
    style: { backgroundColor: "var(--stat-camera-bg)", borderColor: "var(--stat-camera-border)", color: "var(--stat-camera-fg)" },
    iconStyle: { color: "var(--stat-camera-icon)" }
  },
  lensCount: {
    style: { backgroundColor: "var(--stat-lens-bg)", borderColor: "var(--stat-lens-border)", color: "var(--stat-lens-fg)" },
    iconStyle: { color: "var(--stat-lens-icon)" }
  },
  filmStock: {
    style: { backgroundColor: "var(--stat-film-bg)", borderColor: "var(--stat-film-border)", color: "var(--stat-film-fg)" },
    iconStyle: { color: "var(--stat-film-icon)" }
  }
};

export const recentItemCardStyles: CSSProperties[] = [
  { backgroundColor: "var(--recent-item-1-bg)", borderColor: "var(--recent-item-1-border)", color: "var(--recent-item-1-fg)" },
  { backgroundColor: "var(--recent-item-2-bg)", borderColor: "var(--recent-item-2-border)", color: "var(--recent-item-2-fg)" },
  { backgroundColor: "var(--recent-item-3-bg)", borderColor: "var(--recent-item-3-border)", color: "var(--recent-item-3-fg)" },
  { backgroundColor: "var(--recent-item-4-bg)", borderColor: "var(--recent-item-4-border)", color: "var(--recent-item-4-fg)" },
  { backgroundColor: "var(--recent-item-5-bg)", borderColor: "var(--recent-item-5-border)", color: "var(--recent-item-5-fg)" }
];

export const chartPalette = [
  "#c88d85",
  "#8fb17b",
  "#7faea5",
  "#c49b5d",
  "#aaa18d",
  "#b48f74",
  "#89a38f",
  "#9e9d72"
];
