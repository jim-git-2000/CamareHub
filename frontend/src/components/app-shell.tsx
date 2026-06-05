"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Nav } from "@/components/nav";

type ApiState = "loading" | "online" | "error";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiMessage, setApiMessage] = useState("Checking API");

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-base font-semibold">
              CameraHub
            </Link>
            <Badge variant={apiState === "error" ? "destructive" : "secondary"} className="md:hidden">
              {apiState === "loading" ? "Loading" : apiState === "online" ? "Online" : "API error"}
            </Badge>
          </div>
          <Nav />
          <Badge variant={apiState === "error" ? "destructive" : "secondary"} className="hidden md:inline-flex" title={apiMessage}>
            {apiState === "loading" ? "API loading" : apiState === "online" ? "API online" : "API error"}
          </Badge>
        </div>
      </header>
      {apiState === "error" ? (
        <div className="border-b bg-destructive/10">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm text-destructive">{apiMessage}</div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
