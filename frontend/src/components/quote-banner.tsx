"use client";

import { Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { getQuoteBannerSettings } from "@/lib/api";
import {
  DEFAULT_QUOTE_BANNER_SETTINGS,
  QUOTE_BANNER_SETTINGS_CHANGED_EVENT,
  normalizeQuoteBannerSettings,
  pickRandomIndex
} from "@/lib/quote-banner";
import { Badge } from "@/components/ui/badge";

export function QuoteBanner() {
  const [settings, setSettings] = useState<string[] | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const syncSettings = async () => {
      try {
        const response = await getQuoteBannerSettings();
        if (!active) {
          return;
        }

        const normalized = normalizeQuoteBannerSettings({
          intervalSeconds: response.interval_seconds,
          quotes: response.quotes
        });
        setSettings(normalized.quotes);
        setIntervalSeconds(normalized.intervalSeconds);
        setCurrentIndex((previousIndex) => pickRandomIndex(normalized.quotes.length, previousIndex));
      } catch {
        if (!active) {
          return;
        }

        setSettings([...DEFAULT_QUOTE_BANNER_SETTINGS.quotes]);
        setIntervalSeconds(DEFAULT_QUOTE_BANNER_SETTINGS.intervalSeconds);
        setCurrentIndex((previousIndex) => pickRandomIndex(DEFAULT_QUOTE_BANNER_SETTINGS.quotes.length, previousIndex));
      }
    };

    void syncSettings();

    const handleSettingsChanged = () => {
      void syncSettings();
    };

    window.addEventListener(QUOTE_BANNER_SETTINGS_CHANGED_EVENT, handleSettingsChanged as EventListener);

    return () => {
      active = false;
      window.removeEventListener(QUOTE_BANNER_SETTINGS_CHANGED_EVENT, handleSettingsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    if (settings === null || intervalSeconds === null || currentIndex === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentIndex((previousIndex) => pickRandomIndex(settings.length, previousIndex));
    }, intervalSeconds * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentIndex, intervalSeconds, settings]);

  const quote = currentIndex !== null && settings !== null ? settings[currentIndex] ?? settings[0] ?? "" : "";

  return (
    <div className="border-b border-border/70 bg-muted/40">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 text-sm text-foreground">
        <Badge variant="secondary" className="h-6 shrink-0 gap-1.5 rounded-full px-2.5 text-[11px] font-medium tracking-[0.04em]">
          <Quote className="h-3.5 w-3.5" />
          一言
        </Badge>
        <p className="min-w-0 truncate text-center leading-6" title={quote}>
          {quote}
        </p>
        <Badge
          aria-hidden="true"
          variant="secondary"
          className="invisible h-6 shrink-0 gap-1.5 rounded-full px-2.5 text-[11px] font-medium tracking-[0.04em]"
        >
          <Quote className="h-3.5 w-3.5" />
          一言
        </Badge>
      </div>
    </div>
  );
}
