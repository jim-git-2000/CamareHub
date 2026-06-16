"use client";

import Link from "next/link";
import { Moon, Settings, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import { QuoteBanner } from "@/components/quote-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import packageInfo from "../../package.json";

type ApiState = "loading" | "online" | "error";

type AppShellProps = {
  children: ReactNode;
};

type ThemeMode = "light" | "dark";

const APP_VERSION = `v${packageInfo.version}`;

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.86 8.35 6.84 9.71.5.09.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.51.47-3.16-.63-3.36-1.21-.11-.3-.6-1.21-1.03-1.46-.35-.19-.85-.66-.01-.67.79-.01 1.35.75 1.54 1.06.9 1.55 2.34 1.11 2.91.85.09-.67.35-1.11.64-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.25 9.25 0 0 1 12 6.97c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.93.68 1.89 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function applyTheme(theme: ThemeMode) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function HeaderActions({
  apiState,
  apiMessage,
  compact = false,
  theme,
  onThemeToggle
}: {
  apiState: ApiState;
  apiMessage: string;
  compact?: boolean;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const isDark = theme === "dark";
  const ThemeIcon = isDark ? Moon : Sun;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="设置">
        <Link href="/settings" aria-label="设置">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        aria-pressed={isDark}
        title={isDark ? "切换到浅色模式" : "切换到深色模式"}
        onClick={onThemeToggle}
      >
        <ThemeIcon className="h-4 w-4" />
        <span className={compact ? "sr-only" : undefined}>{isDark ? "深色" : "浅色"}</span>
      </Button>
      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
        <a href="https://github.com/jim-git-2000/CamareHub" target="_blank" rel="noreferrer" aria-label="Star CameraHub on GitHub">
          <GitHubMark className="h-4 w-4" />
          <span>Star</span>
        </a>
      </Button>
      <Badge variant={apiState === "error" ? "destructive" : "secondary"} title={apiMessage}>
        {apiState === "loading" ? (compact ? "Loading" : "API loading") : apiState === "online" ? (compact ? "Online" : "API online") : "API error"}
      </Badge>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiMessage, setApiMessage] = useState("Checking API");
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (!active) {
          return;
        }

        setApiState("online");
        setApiMessage(`${health.app} API online`);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setApiState("error");
        setApiMessage(error instanceof Error ? error.message : "API request failed");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("camerahub-theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem("camerahub-theme", nextTheme);
      applyTheme(nextTheme);
      return nextTheme;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_auto_minmax(260px,1fr)] md:items-center">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold">
              <img src="/camerahub-logo.png" alt="" className="h-7 w-auto shrink-0 rounded-sm object-contain" width={44} height={28} />
              <span>CameraHub</span>
              <Badge variant="outline" className="h-5 shrink-0 rounded-full px-2 text-[11px] font-medium leading-none text-muted-foreground">
                {APP_VERSION}
              </Badge>
            </Link>
            <div className="md:hidden">
              <HeaderActions apiState={apiState} apiMessage={apiMessage} compact theme={theme} onThemeToggle={toggleTheme} />
            </div>
          </div>
          <div className="min-w-0 md:justify-self-center">
            <Nav />
          </div>
          <div className="hidden md:block md:justify-self-end">
            <HeaderActions apiState={apiState} apiMessage={apiMessage} theme={theme} onThemeToggle={toggleTheme} />
          </div>
        </div>
      </header>
      <QuoteBanner />
      {apiState === "error" ? (
        <div className="border-b bg-destructive/10">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm text-destructive">{apiMessage}</div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
