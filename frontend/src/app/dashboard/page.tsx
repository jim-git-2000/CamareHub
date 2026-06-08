"use client";

import Link from "next/link";
import { Aperture, CalendarDays, Camera, CircleDollarSign, Film, ImageIcon, MapPin, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, getStatsSummary, listItems, listShootingEntries } from "@/lib/api";
import { recentItemCardStyles, statCardStyles, type StatCardTone } from "@/lib/stat-card-styles";
import type { ItemRead, ShootingEntryPhotoRead, ShootingEntryRead, StatsSummary } from "@/types";

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

type RecentShootingEntriesState =
  | { status: "loading"; entries: ShootingEntryRead[] }
  | { status: "ready"; entries: ShootingEntryRead[] }
  | { status: "error"; entries: ShootingEntryRead[]; message: string };

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0
});

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const fallbackColor: RgbColor = { r: 219, g: 228, b: 219 };

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
    .sort((left, right) => {
      if (left.purchase_date && !right.purchase_date) {
        return -1;
      }

      if (!left.purchase_date && right.purchase_date) {
        return 1;
      }

      if (left.purchase_date && right.purchase_date) {
        const purchaseDiff = new Date(right.purchase_date).getTime() - new Date(left.purchase_date).getTime();

        if (purchaseDiff !== 0) {
          return purchaseDiff;
        }
      }

      const createdDiff = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();

      if (createdDiff !== 0) {
        return createdDiff;
      }

      return right.id - left.id;
    })
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
  const firstPage = await listItems({ page: 1, page_size: pageSize, sort: "-purchase_date" });
  const items = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listItems({ page, page_size: pageSize, sort: "-purchase_date" });
    items.push(...response.items);
  }

  return items;
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const stats = await getStatsSummary();
    let recentItems = sortRecentItems(readRecentItems(stats));

    if (recentItems.length === 0) {
      const recent = await listItems({ page: 1, page_size: 5, sort: "-purchase_date" });
      recentItems = sortRecentItems(recent.items);
    }

    return normalizeStatsSummary(stats, recentItems);
  } catch {
    return summarizeItems(await fetchAllItems());
  }
}

function itemTypeIcon(type: string): typeof CircleDollarSign {
  const icons: Record<string, typeof CircleDollarSign> = {
    camera: Camera,
    lens: Aperture,
    film: Film,
    accessory: PackagePlus
  };

  return icons[type] ?? PackagePlus;
}

function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "未填写日期";
}

function photoSrc(photo: ShootingEntryPhotoRead): string {
  return photo.url.startsWith("http") ? photo.url : `${API_BASE_URL}${photo.url}`;
}

function entryCover(entry: ShootingEntryRead): ShootingEntryPhotoRead | null {
  return entry.photos[0] ?? null;
}

function colorToCss(color: RgbColor, alpha = 1): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${alpha})`;
}

function parseColor(value: string | null | undefined): RgbColor {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) {
    return fallbackColor;
  }

  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function readableTextColor(color: RgbColor): string {
  const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return brightness > 145 ? "rgb(23 23 23)" : "rgb(250 250 250)";
}

function mutedTextColor(color: RgbColor): string {
  const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return brightness > 145 ? "rgb(64 64 64 / 0.78)" : "rgb(255 255 255 / 0.78)";
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

function RecentItemCard({ item, index }: { item: ItemRead; index: number }) {
  const Icon = itemTypeIcon(item.type);
  const style = recentItemCardStyles[index % recentItemCardStyles.length];
  const price = readNumber(item.purchase_price, item.current_value);

  return (
    <Link href={`/items/${item.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div
        className="overflow-hidden rounded-md border transition-colors hover:brightness-[0.98]"
        style={style}
      >
        <div className="grid min-h-[120px] gap-0 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="order-2 flex min-h-[120px] items-start justify-end p-4 md:order-2 md:h-full">
            <div className="rounded-full bg-background/60 p-2 text-current shadow-sm">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="order-1 flex min-w-0 flex-col justify-center gap-2 p-4">
            <div className="truncate text-sm font-semibold">
              {item.brand} {item.model}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-current/70">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(item.purchase_date)}
              </span>
              <span>{currencyFormatter.format(price)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RecentShootingEntryCard({ entry }: { entry: ShootingEntryRead }) {
  const cover = entryCover(entry);
  const color = parseColor(cover?.dominant_color);
  const foreground = readableTextColor(color);
  const mutedForeground = mutedTextColor(color);

  return (
    <Link href={`/films/${entry.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div
        className="overflow-hidden rounded-md border transition-colors duration-300 hover:border-primary/60"
        style={{ backgroundColor: colorToCss(color) }}
      >
        <div className="grid min-h-[120px] gap-0 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="order-2 aspect-[4/3] bg-muted md:order-2 md:h-full md:min-h-[120px]">
            {cover ? (
              <div className="relative h-full">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-32 md:block"
                  style={{
                    background: `linear-gradient(90deg, ${colorToCss(color)} 0%, ${colorToCss(color, 0.98)} 22%, ${colorToCss(color, 0.72)} 50%, ${colorToCss(color, 0.28)} 78%, transparent 100%)`
                  }}
                />
                <img src={photoSrc(cover)} alt={cover.file_name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center" style={{ color: mutedForeground }}>
                <ImageIcon className="h-7 w-7" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="order-1 flex min-w-0 flex-col justify-center gap-2 p-4" style={{ color: foreground }}>
            <div className="truncate text-sm font-semibold">{entry.title}</div>
            <div className="flex flex-wrap gap-3 text-xs" style={{ color: mutedForeground }}>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(entry.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {entry.location || "未填写地点"}
              </span>
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {entry.photo_count} 张图片
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RecentShootingEntriesCard({ state }: { state: RecentShootingEntriesState }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">最近拍摄事项</CardTitle>
        <CardDescription>展示最近 5 条拍摄记录</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-md border px-4 py-3">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="mt-3 h-3 w-64 max-w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-md border border-destructive/40 px-4 py-3 text-sm text-destructive">{state.message}</div>
        ) : null}

        {state.status === "ready" && state.entries.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无拍摄事项</div>
        ) : null}

        {state.entries.length > 0 ? (
          <div className="space-y-3">
            {state.entries.map((entry) => (
              <RecentShootingEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
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

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [recentShootingEntriesState, setRecentShootingEntriesState] = useState<RecentShootingEntriesState>({
    status: "loading",
    entries: []
  });

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
          setState({ status: "error", message: error instanceof Error ? error.message : "概览数据加载失败" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    listShootingEntries({ page: 1, page_size: 5 })
      .then((response) => {
        if (active) {
          setRecentShootingEntriesState({ status: "ready", entries: response.items });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRecentShootingEntriesState({
            status: "error",
            entries: [],
            message: error instanceof Error ? error.message : "最近拍摄事项加载失败"
          });
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
        icon: CircleDollarSign,
        tone: "totalValue" as const
      },
      {
        title: "相机数量",
        value: String(state.summary.cameraCount),
        description: "类型为 camera 的器材",
        icon: Camera,
        tone: "cameraCount" as const
      },
      {
        title: "镜头数量",
        value: String(state.summary.lensCount),
        description: "类型为 lens 的器材",
        icon: Aperture,
        tone: "lensCount" as const
      },
      {
        title: "胶片库存",
        value: String(state.summary.filmStock),
        description: "按胶片数量汇总",
        icon: Film,
        tone: "filmStock" as const
      }
    ];
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">概览</h1>
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
          <h1 className="text-2xl font-semibold tracking-normal">概览</h1>
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
        <h1 className="text-2xl font-semibold tracking-normal">概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">基础概览</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
            <CardHeader className="pb-4">
              <CardTitle className="text-base">最近新增器材</CardTitle>
              <CardDescription>按购买日期展示最近 5 条记录</CardDescription>
            </CardHeader>
            <CardContent>
              {state.summary.recentItems.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">暂无最近新增器材</div>
              ) : (
                <div className="space-y-3">
                  {state.summary.recentItems.map((item, index) => (
                    <RecentItemCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <RecentShootingEntriesCard state={recentShootingEntriesState} />
      </div>
    </div>
  );
}
