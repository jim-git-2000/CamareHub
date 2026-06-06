"use client";

import Link from "next/link";
import { CalendarDays, Camera, ImageIcon, Loader2, MapPin, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ShootingEntryFormDialog } from "@/components/shooting-entry-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, listItems, listShootingEntries } from "@/lib/api";
import type { ItemRead, ShootingEntryItemRole, ShootingEntryPhotoRead, ShootingEntryRead } from "@/types";

type EntriesState =
  | { status: "loading"; entries: ShootingEntryRead[]; total: number }
  | { status: "ready"; entries: ShootingEntryRead[]; total: number }
  | { status: "error"; entries: ShootingEntryRead[]; total: number; message: string };

const allValue = "all";

function photoSrc(photo: ShootingEntryPhotoRead): string {
  return photo.url.startsWith("http") ? photo.url : `${API_BASE_URL}${photo.url}`;
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

function EntryCard({ entry }: { entry: ShootingEntryRead }) {
  const cover = entryCover(entry);
  const shownLinks = entry.item_links.slice(0, 4);
  const hiddenCount = Math.max(0, entry.item_links.length - shownLinks.length);

  return (
    <Link href={`/films/${entry.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="overflow-hidden transition-colors hover:border-primary/60">
        <div className="grid gap-0 md:grid-cols-[220px,1fr]">
          <div className="aspect-[4/3] bg-muted md:h-full md:min-h-48">
            {cover ? (
              <img src={photoSrc(cover)} alt={cover.file_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-44 items-center justify-center text-muted-foreground">
                <ImageIcon className="h-9 w-9" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="space-y-4 p-4">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold tracking-normal">{entry.title}</h2>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {formatDate(entry.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {entry.location || "未填写地点"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  {entry.photo_count} 张图片
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {entry.item_links.length === 0 ? <Badge variant="outline">未关联设备</Badge> : null}
              {shownLinks.map((link) => (
                <Badge key={link.id} variant="secondary" className="gap-1">
                  {roleLabel(link.role)}: {itemLabel(link.item)}
                </Badge>
              ))}
              {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount}</Badge> : null}
            </div>

            {entry.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{entry.notes}</p> : null}
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
  const [itemFilter, setItemFilter] = useState(allValue);
  const [formOpen, setFormOpen] = useState(false);

  const loadEntries = async () => {
    setEntriesState((current) => ({ status: "loading", entries: current.entries, total: current.total }));
    try {
      const response = await listShootingEntries({
        keyword: keyword.trim() || undefined,
        item_id: itemFilter === allValue ? undefined : Number(itemFilter),
        page: 1,
        page_size: 100
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
    listItems({ page: 1, page_size: 100, sort: "brand" })
      .then((response) => setItems(response.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setEntriesState((current) => ({ status: "loading", entries: current.entries, total: current.total }));
      try {
        const response = await listShootingEntries({
          keyword: keyword.trim() || undefined,
          item_id: itemFilter === allValue ? undefined : Number(itemFilter),
          page: 1,
          page_size: 100
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
  }, [itemFilter, keyword]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">照片记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">按拍摄事项汇总照片、地点和关联设备</p>
        </div>
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          新增记录
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、地点或备注" className="pl-9" />
          </div>
          <Select value={itemFilter} onValueChange={setItemFilter}>
            <SelectTrigger aria-label="关联器材筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allValue}>全部关联器材</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {itemLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : null}

      <ShootingEntryFormDialog
        open={formOpen}
        entry={null}
        items={items}
        onOpenChange={setFormOpen}
        onSaved={loadEntries}
      />
    </div>
  );
}
