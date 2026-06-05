"use client";

import Link from "next/link";
import { Aperture, Camera, CircleDollarSign, Film, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatsSummary, listItems } from "@/lib/api";
import type { ItemRead, StatsSummary } from "@/types";

type DashboardSummary = {
  totalValue: number;
  cameraCount: number;
  lensCount: number;
  filmStock: number;
  recentItems: ItemRead[];
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; summary: DashboardSummary }
  | { status: "error"; message: string };

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0
});

function readNumber(...values: Array<number | string | null | undefined>): number {
  for (const value of values) {
    const parsed = typeof value === "string" ? Number(value) : value;

    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readRecentItems(summary: StatsSummary): ItemRead[] {
  return summary.recent_items ?? summary.recentItems ?? [];
}

function normalizeStatsSummary(summary: StatsSummary, recentItems: ItemRead[]): DashboardSummary {
  return {
    totalValue: readNumber(
      summary.total_value,
      summary.totalAssetValue,
      summary.asset_value,
      summary.current_value_total,
      summary.total_current_value
    ),
    cameraCount: readNumber(summary.camera_count, summary.cameraCount, summary.cameras),
    lensCount: readNumber(summary.lens_count, summary.lensCount, summary.lenses),
    filmStock: readNumber(summary.film_stock, summary.filmStock, summary.film_quantity, summary.filmQuantity),
    recentItems
  };
}

function sortRecentItems(items: ItemRead[]): ItemRead[] {
  return [...items]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 5);
}

function summarizeItems(items: ItemRead[]): DashboardSummary {
  return {
    totalValue: items.reduce((sum, item) => sum + readNumber(item.current_value), 0),
    cameraCount: items.filter((item) => item.type === "camera").length,
    lensCount: items.filter((item) => item.type === "lens").length,
    filmStock: items
      .filter((item) => item.type === "film")
      .reduce((sum, item) => sum + readNumber(item.film?.quantity, 1), 0),
    recentItems: sortRecentItems(items)
  };
}

async function fetchAllItems(): Promise<ItemRead[]> {
  const pageSize = 100;
  const firstPage = await listItems({ page: 1, page_size: pageSize, sort: "-created_at" });
  const items = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listItems({ page, page_size: pageSize, sort: "-created_at" });
    items.push(...response.items);
  }

  return items;
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const stats = await getStatsSummary();
    let recentItems = readRecentItems(stats).slice(0, 5);

    if (recentItems.length === 0) {
      const recent = await listItems({ page: 1, page_size: 5, sort: "-created_at" });
      recentItems = recent.items;
    }

    return normalizeStatsSummary(stats, recentItems);
  } catch {
    return summarizeItems(await fetchAllItems());
  }
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    camera: "相机",
    lens: "镜头",
    film: "胶片",
    accessory: "配件"
  };

  return labels[type] ?? type;
}

function isEmptySummary(summary: DashboardSummary): boolean {
  return (
    summary.totalValue === 0 &&
    summary.cameraCount === 0 &&
    summary.lensCount === 0 &&
    summary.filmStock === 0 &&
    summary.recentItems.length === 0
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardDescription>{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="break-words text-2xl font-semibold tracking-normal">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    fetchDashboardSummary()
      .then((summary) => {
        if (active) {
          setState({ status: "ready", summary });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Dashboard data failed to load" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return [
      {
        title: "总资产估值",
        value: currencyFormatter.format(state.summary.totalValue),
        description: "按当前估值汇总",
        icon: CircleDollarSign
      },
      {
        title: "相机数量",
        value: String(state.summary.cameraCount),
        description: "类型为 camera 的器材",
        icon: Camera
      },
      {
        title: "镜头数量",
        value: String(state.summary.lensCount),
        description: "类型为 lens 的器材",
        icon: Aperture
      },
      {
        title: "胶片库存",
        value: String(state.summary.filmStock),
        description: "按胶片数量汇总",
        icon: Film
      }
    ];
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">正在加载概览数据...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="mt-4 h-8 w-20 rounded bg-muted" />
                <div className="mt-3 h-3 w-28 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">基础概览</p>
        </div>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">数据加载失败</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const empty = isEmptySummary(state.summary);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">基础概览</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 py-10 text-center">
            <PackagePlus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-base font-medium tracking-normal">暂无器材数据</h2>
              <p className="mt-1 text-sm text-muted-foreground">添加器材后，这里会显示资产概览和最近新增列表。</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近新增器材</CardTitle>
            <CardDescription>按创建时间展示最近 5 条记录</CardDescription>
          </CardHeader>
          <CardContent>
            {state.summary.recentItems.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无最近新增器材</div>
            ) : (
              <div className="divide-y rounded-md border">
                {state.summary.recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.brand} {item.model}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{item.nickname || item.location || "未填写备注信息"}</div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                      <span className="text-xs text-muted-foreground">{currencyFormatter.format(readNumber(item.current_value))}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
