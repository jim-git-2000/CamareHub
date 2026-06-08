"use client";

import { useEffect, useState } from "react";
import { ApiError, getQuoteBannerSettings, resetQuoteBannerSettings, updateQuoteBannerSettings } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_QUOTE_BANNER_SETTINGS,
  QUOTE_BANNER_SETTINGS_CHANGED_EVENT,
  serializeQuoteLines,
  splitQuoteLines
} from "@/lib/quote-banner";

export default function SettingsPage() {
  const [intervalSeconds, setIntervalSeconds] = useState(String(DEFAULT_QUOTE_BANNER_SETTINGS.intervalSeconds));
  const [quotes, setQuotes] = useState(serializeQuoteLines(DEFAULT_QUOTE_BANNER_SETTINGS.quotes));
  const [statusMessage, setStatusMessage] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");

  useEffect(() => {
    let active = true;

    getQuoteBannerSettings()
      .then((settings) => {
        if (!active) {
          return;
        }

        setIntervalSeconds(String(settings.interval_seconds));
        setQuotes(serializeQuoteLines(settings.quotes));

        const source =
          settings.uses_default_interval && settings.uses_default_quotes
            ? "当前使用内置默认时间和内置默认文案。"
            : "当前时间和文案都来自 data/quote_banner.txt。";
        setSourceMessage(source);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setSourceMessage(error instanceof Error ? error.message : "一言设置加载失败");
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      const nextSettings = {
        interval_seconds: Number(intervalSeconds),
        quotes: splitQuoteLines(quotes)
      };

      const saved = await updateQuoteBannerSettings(nextSettings);
      setIntervalSeconds(String(saved.interval_seconds));
      setQuotes(serializeQuoteLines(saved.quotes));
      setSourceMessage("当前时间和文案都来自 data/quote_banner.txt。");
      window.dispatchEvent(new Event(QUOTE_BANNER_SETTINGS_CHANGED_EVENT));
      setStatusMessage("设置已保存");
    } catch (error: unknown) {
      setStatusMessage(error instanceof ApiError ? error.message : "设置保存失败");
    }
  };

  const handleReset = async () => {
    try {
      const nextSettings = await resetQuoteBannerSettings();
      setIntervalSeconds(String(nextSettings.interval_seconds));
      setQuotes(serializeQuoteLines(nextSettings.quotes));
      setSourceMessage("已删除 data/quote_banner.txt，当前回退到内置默认时间和默认文案。");
      window.dispatchEvent(new Event(QUOTE_BANNER_SETTINGS_CHANGED_EVENT));
      setStatusMessage("已恢复默认文案");
    } catch (error: unknown) {
      setStatusMessage(error instanceof ApiError ? error.message : "恢复默认失败");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">配置顶部的一言切换时间和文案内容。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">摄影一言</CardTitle>
          <CardDescription>默认文案写在程序内部；自定义时间和自定义文案写入 data/quote_banner.txt。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{sourceMessage}</div>

          <div className="grid gap-2 sm:max-w-xs">
            <label htmlFor="quote-interval" className="text-sm font-medium">
              切换时间（秒）
            </label>
            <Input
              id="quote-interval"
              type="number"
              min={3}
              max={3600}
              step={1}
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quote-list" className="text-sm font-medium">
              自定义一言
            </label>
            <Textarea
              id="quote-list"
              value={quotes}
              onChange={(event) => setQuotes(event.target.value)}
              rows={22}
              className="min-h-[420px] font-mono text-sm leading-6"
              placeholder="每行输入一句一言"
            />
            <p className="text-xs text-muted-foreground">每行一条。保存后会把当前切换时间和当前文案一起写入 data/quote_banner.txt。</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button type="button" onClick={handleSave}>
            保存设置
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            恢复默认
          </Button>
          {statusMessage ? <span className="text-sm text-muted-foreground">{statusMessage}</span> : null}
        </CardFooter>
      </Card>
    </div>
  );
}
