"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ShootingEntryFormDialog } from "@/components/shooting-entry-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { API_BASE_URL, listItems, listShootingEntries } from "@/lib/api";
import type { ItemRead, ShootingEntryItemRole, ShootingEntryPhotoRead, ShootingEntryRead } from "@/types";

type EntriesState =
  | { status: "loading"; entries: ShootingEntryRead[]; total: number }
  | { status: "ready"; entries: ShootingEntryRead[]; total: number }
  | { status: "error"; entries: ShootingEntryRead[]; total: number; message: string };

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const PAGE_SIZE = 24;

async function fetchAllItems(): Promise<ItemRead[]> {
  const first = await listItems({ page: 1, page_size: 100, sort: "brand" });
  const items = [...first.items];
  const pages = Math.ceil(first.total / 100);
  for (let page = 2; page <= pages; page += 1) {
    const response = await listItems({ page, page_size: 100, sort: "brand" });
    items.push(...response.items);
  }
  return items;
}

const fallbackColor: RgbColor = { r: 219, g: 228, b: 219 };

function thumbnailSrc(photo: ShootingEntryPhotoRead): string | null {
  if (!photo.thumbnail_url) {
    return null;
  }

  return photo.thumbnail_url.startsWith("http") ? photo.thumbnail_url : `${API_BASE_URL}${photo.thumbnail_url}`;
}

function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "未填写日期";
}

function itemLabel(item: ItemRead): string {
  return `${item.brand} ${item.model}`;
}

function roleLabel(role: ShootingEntryItemRole): string {
  const labels: Record<ShootingEntryItemRole, string> = {
    camera: "相机",
    lens: "镜头",
    film: "胶片",
    other: "其他"
  };
  return labels[role];
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

function selectedSummary(items: ItemRead[], selectedIds: number[]): string {
  if (selectedIds.length === 0) {
    return "不限";
  }
  if (selectedIds.length === 1) {
    const item = items.find((candidate) => candidate.id === selectedIds[0]);
    return item ? itemLabel(item) : "已选择 1 项";
  }
  return `已选择 ${selectedIds.length} 项`;
}

function toggleId(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function MultiItemFilter({
  label,
  items,
  selectedIds,
  onChange
}: {
  label: string;
  items: ItemRead[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {selectedIds.length > 0 ? (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>
            清空
          </button>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between gap-2 px-3 py-2 text-left font-normal">
            <span className="min-w-0 truncate">{selectedSummary(items, selectedIds)}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <DropdownMenuItem disabled>暂无可选项</DropdownMenuItem>
          ) : (
            items.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.id}
                checked={selectedIds.includes(item.id)}
                onCheckedChange={() => onChange(toggleId(selectedIds, item.id))}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="truncate">{itemLabel(item)}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CoverColorEntryCard({ entry }: { entry: ShootingEntryRead }) {
  const cover = entryCover(entry);
  const coverUrl = cover ? thumbnailSrc(cover) : null;
  const color = parseColor(cover?.dominant_color);
  const shownLinks = entry.item_links.slice(0, 4);
  const hiddenCount = Math.max(0, entry.item_links.length - shownLinks.length);
  const foreground = readableTextColor(color);
  const mutedForeground = mutedTextColor(color);

  return (
    <Link href={`/films/${entry.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card
        className="overflow-hidden border transition-colors duration-300 hover:border-primary/60"
        style={{ backgroundColor: colorToCss(color) }}
      >
        <div className="grid min-h-40 gap-0 md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="order-2 aspect-[4/3] bg-muted md:order-2 md:h-full md:min-h-40">
            {coverUrl ? (
              <div className="relative h-full">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-36 md:block"
                  style={{
                    background: `linear-gradient(90deg, ${colorToCss(color)} 0%, ${colorToCss(color, 0.99)} 16%, ${colorToCss(color, 0.82)} 38%, ${colorToCss(color, 0.52)} 62%, ${colorToCss(color, 0.18)} 84%, transparent 100%)`
                  }}
                />
                <Image
                  src={coverUrl}
                  alt={cover?.file_name ?? entry.title}
                  width={800}
                  height={600}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-full min-h-36 items-center justify-center" style={{ color: mutedForeground }}>
                <ImageIcon className="h-7 w-7" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="order-1 flex min-w-0 flex-col justify-between gap-3 p-3.5 sm:p-4" style={{ color: foreground }}>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold leading-snug tracking-normal">{entry.title}</h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs" style={{ color: mutedForeground }}>
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

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {entry.item_links.length === 0 ? (
                  <Badge variant="outline" className="bg-background/60">
                    未关联设备
                  </Badge>
                ) : null}
                {shownLinks.map((link) => (
                  <Badge key={link.id} variant="secondary" className="gap-1 bg-background/70 text-foreground">
                    {roleLabel(link.role)}: {itemLabel(link.item)}
                  </Badge>
                ))}
                {hiddenCount > 0 ? (
                  <Badge variant="outline" className="bg-background/60">
                    +{hiddenCount}
                  </Badge>
                ) : null}
              </div>

              {entry.notes ? <p className="line-clamp-1 text-xs" style={{ color: mutedForeground }}>{entry.notes}</p> : null}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function FilmsPage() {
  const [entriesState, setEntriesState] = useState<EntriesState>({ status: "loading", entries: [], total: 0 });
  const [items, setItems] = useState<ItemRead[]>([]);
  const [keyword, setKeyword] = useState("");
  const [cameraItemIds, setCameraItemIds] = useState<number[]>([]);
  const [lensItemIds, setLensItemIds] = useState<number[]>([]);
  const [filmItemIds, setFilmItemIds] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const itemGroups = useMemo(
    () => ({
      cameras: items.filter((item) => item.type === "camera"),
      lenses: items.filter((item) => item.type === "lens"),
      films: items.filter((item) => item.type === "film")
    }),
    [items]
  );

  const loadEntries = async () => {
    setEntriesState((current) => ({ status: "loading", entries: current.entries, total: current.total }));
    try {
      const response = await listShootingEntries({
        keyword: keyword.trim() || undefined,
        camera_item_ids: cameraItemIds,
        lens_item_ids: lensItemIds,
        film_item_ids: filmItemIds,
        page: 1,
        page_size: PAGE_SIZE
      });
      setEntriesState({ status: "ready", entries: response.items, total: response.total });
    } catch (error) {
      setEntriesState({
        status: "error",
        entries: [],
        total: 0,
        message: error instanceof Error ? error.message : "照片记录加载失败"
      });
    }
  };

  useEffect(() => {
    fetchAllItems()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setEntriesState((current) => ({ status: "loading", entries: current.entries, total: current.total }));
      try {
        const response = await listShootingEntries({
          keyword: keyword.trim() || undefined,
          camera_item_ids: cameraItemIds,
          lens_item_ids: lensItemIds,
          film_item_ids: filmItemIds,
          page: 1,
          page_size: PAGE_SIZE
        });
        if (active) {
          setEntriesState({ status: "ready", entries: response.items, total: response.total });
        }
      } catch (error) {
        if (active) {
          setEntriesState({
            status: "error",
            entries: [],
            total: 0,
            message: error instanceof Error ? error.message : "照片记录加载失败"
          });
        }
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [cameraItemIds, filmItemIds, keyword, lensItemIds]);

  const hasActiveFilters = cameraItemIds.length > 0 || lensItemIds.length > 0 || filmItemIds.length > 0;

  const loadMore = async () => {
    if (entriesState.status !== "ready" || entriesState.entries.length >= entriesState.total || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = Math.floor(entriesState.entries.length / PAGE_SIZE) + 1;
      const response = await listShootingEntries({
        keyword: keyword.trim() || undefined,
        camera_item_ids: cameraItemIds,
        lens_item_ids: lensItemIds,
        film_item_ids: filmItemIds,
        page,
        page_size: PAGE_SIZE
      });
      setEntriesState((current) => current.status === "ready"
        ? { status: "ready", entries: [...current.entries, ...response.items], total: response.total }
        : current);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">照片</h1>
          <p className="mt-1 text-sm text-muted-foreground">按拍摄事项汇总照片、地点和关联设备</p>
        </div>
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          新增记录
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_220px_220px_220px_auto]">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">搜索</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、地点或备注" className="pl-9" />
            </div>
          </div>
          <MultiItemFilter label="相机" items={itemGroups.cameras} selectedIds={cameraItemIds} onChange={setCameraItemIds} />
          <MultiItemFilter label="镜头" items={itemGroups.lenses} selectedIds={lensItemIds} onChange={setLensItemIds} />
          <MultiItemFilter label="胶片" items={itemGroups.films} selectedIds={filmItemIds} onChange={setFilmItemIds} />
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full lg:w-auto"
              disabled={!hasActiveFilters && !keyword}
              onClick={() => {
                setKeyword("");
                setCameraItemIds([]);
                setLensItemIds([]);
                setFilmItemIds([]);
              }}
            >
              <X className="mr-2 h-4 w-4" aria-hidden="true" />
              清空
            </Button>
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {entriesState.status === "loading" ? "正在加载照片记录..." : `共 ${entriesState.total} 条记录`}
      </div>

      {entriesState.status === "error" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">照片记录加载失败</CardTitle>
            <CardDescription>{entriesState.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {entriesState.status === "loading" && entriesState.entries.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            正在加载...
          </div>
        </div>
      ) : null}

      {entriesState.status !== "loading" && entriesState.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-base font-medium tracking-normal">暂无照片记录</h2>
          <p className="mt-1 text-sm text-muted-foreground">新增记录后，可以进入详情关联设备并上传本次拍摄的照片。</p>
        </div>
      ) : null}

      {entriesState.entries.length > 0 ? (
        <div className="space-y-4">
          {entriesState.entries.map((entry) => (
            <CoverColorEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : null}

      {entriesState.status === "ready" && entriesState.entries.length < entriesState.total ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      ) : null}

      <ShootingEntryFormDialog
        open={formOpen}
        entry={null}
        onOpenChange={setFormOpen}
        onSaved={loadEntries}
      />
    </div>
  );
}
