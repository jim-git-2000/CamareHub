import type { Metadata } from "next";
import { type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CameraHub",
  description: "Local photography gear management"
};

const themeInitScript = `
try {
  var theme = window.localStorage.getItem("camerahub-theme");
  var isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
} catch (_) {}
`;

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
