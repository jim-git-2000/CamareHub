import type { CSSProperties } from "react";

export type StatCardTone = "totalValue" | "cameraCount" | "lensCount" | "filmStock";

type ToneStyle = {
  style: CSSProperties;
  iconStyle: CSSProperties;
};

export const statCardStyles: Record<StatCardTone, ToneStyle> = {
  totalValue: {
    style: { backgroundColor: "#d8eee5", borderColor: "#9fcfbb", color: "#17392f" },
    iconStyle: { color: "#2d7a65" }
  },
  cameraCount: {
    style: { backgroundColor: "#d8eaf4", borderColor: "#9fc6dc", color: "#17354a" },
    iconStyle: { color: "#2d6f91" }
  },
  lensCount: {
    style: { backgroundColor: "#e4def1", borderColor: "#beb0dc", color: "#33284d" },
    iconStyle: { color: "#6a5798" }
  },
  filmStock: {
    style: { backgroundColor: "#f2e4c8", borderColor: "#d9bd83", color: "#4a3517" },
    iconStyle: { color: "#946f29" }
  }
};

export const recentItemCardStyles: CSSProperties[] = [
  { backgroundColor: "#ead8d2", borderColor: "#cda99e", color: "#442b24" },
  { backgroundColor: "#d9e3d0", borderColor: "#acc49d", color: "#263b22" },
  { backgroundColor: "#d4e4df", borderColor: "#9ebfb4", color: "#203b35" },
  { backgroundColor: "#e7d9c4", borderColor: "#c9aa79", color: "#433019" },
  { backgroundColor: "#dedbd1", borderColor: "#bbb4a4", color: "#353026" }
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
