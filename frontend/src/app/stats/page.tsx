"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { CircleDollarSign, PieChart, BarChart3, Loader2, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStatsByBrand,
  getStatsByType,
  getStatsFilmStock,
  getStatsLensFocalLength,
  getStatsSummary
} from "@/lib/api";
import { chartPalette, statCardStyles, type StatCardTone } from "@/lib/stat-card-styles";
import type { FilmStockBucket, LensFocalLengthBucket, StatsBucket, StatsSummary } from "@/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type StatsState =
  | { status: "loading" }
  | {
      status: "ready";
      summary: StatsSummary;
      byBrand: StatsBucket[];
      byType: StatsBucket[];
      lensFocalLength: LensFocalLengthBucket[];
      filmStock: FilmStockBucket[];
    }
  | { status: "error"; message: string };

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0
});

function pieOption(title: string, data: Array<{ name: string; value: number }>): EChartsOption {
  return {
    color: chartPalette,
    tooltip: { trigger: "item" },
    legend: { bottom: 0, type: "scroll" },
    series: [
      {
        name: title,
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        data
      }
    ]
  };
}

function barOption(name: string, labels: string[], values: number[]): EChartsOption {
  return {
    color: chartPalette,
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 24, bottom: 64 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { interval: 0, rotate: labels.length > 4 ? 30 : 0 }
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      {
        name,
        type: "bar",
        data: values,
        barMaxWidth: 42,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: { dataIndex: number }) => chartPalette[params.dataIndex % chartPalette.length]
        }
      }
    ]
  };
}

function isEmptyStats(state: Extract<StatsState, { status: "ready" }>): boolean {
  return (
    state.summary.total_value === 0 &&
    state.summary.camera_count === 0 &&
    state.summary.lens_count === 0 &&
    state.summary.film_stock === 0 &&
    state.byBrand.length === 0 &&
    state.byType.length === 0 &&
    state.lensFocalLength.length === 0 &&
    state.filmStock.length === 0
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof CircleDollarSign;
  tone: StatCardTone;
}) {
  const toneStyle = statCardStyles[tone];

  return (
    <Card style={toneStyle.style}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardDescription className="font-semibold text-current/80">{title}</CardDescription>
        <Icon className="h-4 w-4" style={toneStyle.iconStyle} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="break-words text-2xl font-semibold tracking-normal">{value}</div>
        <p className="mt-1 text-xs text-current/70">{description}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  empty,
  option
}: {
  title: string;
  description: string;
  empty: boolean;
  option: EChartsOption;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            <Package className="mb-2 h-7 w-7" aria-hidden="true" />
            暂无数据
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 320, width: "100%" }} />
        )}
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [state, setState] = useState<StatsState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    Promise.all([
      getStatsSummary(),
      getStatsByBrand(),
      getStatsByType(),
      getStatsLensFocalLength(),
      getStatsFilmStock()
    ])
      .then(([summary, byBrand, byType, lensFocalLength, filmStock]) => {
        if (active) {
          setState({ status: "ready", summary, byBrand, byType, lensFocalLength, filmStock });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: "error", message: error instanceof Error ? error.message : "统计数据加载失败" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const chartOptions = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return {
      brand: pieOption(
        "品牌占比",
        state.byBrand.map((item) => ({ name: item.label, value: item.count }))
      ),
      type: pieOption(
        "类型占比",
        state.byType.map((item) => ({ name: item.label, value: item.count }))
      ),
      lens: barOption(
        "镜头数量",
        state.lensFocalLength.map((item) => item.label),
        state.lensFocalLength.map((item) => item.count)
      ),
      film: barOption(
        "库存数量",
        state.filmStock.map((item) => item.label),
        state.filmStock.map((item) => item.quantity)
      )
    };
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载统计数据...
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Stats</h1>
          <p className="mt-1 text-sm text-muted-foreground">统计图表</p>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">统计数据加载失败</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const empty = isEmptyStats(state);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">统计图表</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总资产估值"
          value={currencyFormatter.format(state.summary.total_value)}
          description="按当前估值汇总"
          icon={CircleDollarSign}
          tone="totalValue"
        />
        <StatCard title="相机数量" value={String(state.summary.camera_count)} description="类型为 camera 的器材" icon={PieChart} tone="cameraCount" />
        <StatCard title="镜头数量" value={String(state.summary.lens_count)} description="类型为 lens 的器材" icon={BarChart3} tone="lensCount" />
        <StatCard title="胶片库存" value={String(state.summary.film_stock)} description="按胶片数量汇总" icon={Package} tone="filmStock" />
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Package className="mb-2 h-8 w-8" aria-hidden="true" />
            暂无统计数据
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="品牌占比"
            description="按器材品牌统计数量"
            empty={state.byBrand.length === 0}
            option={chartOptions?.brand ?? {}}
          />
          <ChartCard
            title="器材类型占比"
            description="按 camera、lens、film、accessory 统计数量"
            empty={state.byType.length === 0}
            option={chartOptions?.type ?? {}}
          />
          <ChartCard
            title="焦段分布"
            description="按镜头焦段统计数量"
            empty={state.lensFocalLength.length === 0}
            option={chartOptions?.lens ?? {}}
          />
          <ChartCard
            title="胶片库存"
            description="按胶片器材统计库存数量"
            empty={state.filmStock.length === 0}
            option={chartOptions?.film ?? {}}
          />
        </div>
      )}
    </div>
  );
}
