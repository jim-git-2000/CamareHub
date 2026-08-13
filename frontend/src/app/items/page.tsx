"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Aperture, Camera, Film, ImageIcon, Package, Plus, Search, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, getItemFacets, listItems } from "@/lib/api";
import {
  ALL_ITEM_FILTERS,
  DEFAULT_ITEM_FILTERS,
  itemDetailHref,
  itemListHref,
  itemListScrollStorageKey,
  parseItemListRoute,
  type ItemListFilters
} from "@/lib/item-list-route";
import type { ItemRead } from "@/types";

type ItemsState =
  | { status: "loading"; href: string; items: ItemRead[]; total: number }
  | { status: "ready"; href: string; items: ItemRead[]; total: number }
  | { status: "error"; href: string; items: ItemRead[]; total: number; message: string };

const PAGE_SIZE = 24;

const typeOptions = [
  { value: ALL_ITEM_FILTERS, label: "全部类型" },
  { value: "camera", label: "相机" },
  { value: "lens", label: "镜头" },
  { value: "film", label: "胶片" },
  { value: "accessory", label: "配件" }
];

const statusOptions = [
  { value: ALL_ITEM_FILTERS, label: "全部状态" },
  { value: "owned", label: "持有" },
  { value: "sold", label: "已出售" },
  { value: "wishlist", label: "愿望清单" }
];

const statusLabels: Record<string, string> = {
  owned: "持有",
  sold: "已出售",
  wishlist: "愿望清单",
  archived: "已归档"
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function typeLabel(type: string): string {
  return typeOptions.find((option) => option.value === type)?.label ?? type;
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const normalized = currency || "CNY";
  const cached = currencyFormatters.get(normalized);

  if (cached) {
    return cached;
  }

  try {
    const formatter = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 0
    });
    currencyFormatters.set(normalized, formatter);
    return formatter;
  } catch {
    const formatter = new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 0
    });
    currencyFormatters.set(normalized, formatter);
    return formatter;
  }
}

function formatCurrency(value: number | null | undefined, currency: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未填写";
  }

  return getCurrencyFormatter(currency).format(value);
}

function priceSummary(item: ItemRead): string {
  return `购买 ${formatCurrency(item.purchase_price, item.currency)} / 估值 ${formatCurrency(item.current_value, item.currency)}`;
}

function formatNumber(value: number | null | undefined, suffix = ""): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `${value}${suffix}`;
}

function joinDefined(values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" / ");
}

function keyParams(item: ItemRead): string {
  if (item.type === "camera") {
    return (
      joinDefined([
        item.camera?.mount,
        item.camera?.format,
        item.camera?.camera_type,
        formatNumber(item.camera?.megapixels, "MP")
      ]) || item.condition
    );
  }

  if (item.type === "lens") {
    const focalLength =
      item.lens?.focal_length_min && item.lens?.focal_length_max
        ? item.lens.focal_length_min === item.lens.focal_length_max
          ? `${item.lens.focal_length_min}mm`
          : `${item.lens.focal_length_min}-${item.lens.focal_length_max}mm`
        : null;
    const aperture = formatNumber(item.lens?.aperture_max, " max");

    return joinDefined([item.lens?.mount, focalLength, aperture, item.lens?.autofocus ? "AF" : null]) || item.condition;
  }

  if (item.type === "film") {
    return (
      joinDefined([
        formatNumber(item.film?.iso, " ISO"),
        item.film?.film_format,
        item.film?.color_type,
        formatNumber(item.film?.quantity, " 卷")
      ]) || item.condition
    );
  }

  return joinDefined([item.condition, item.location]) || "暂无关键参数";
}

function ItemTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "camera") {
    return <Camera className={className} aria-hidden="true" />;
  }
  if (type === "lens") {
    return <Aperture className={className} aria-hidden="true" />;
  }
  if (type === "film") {
    return <Film className={className} aria-hidden="true" />;
  }
  return <Package className={className} aria-hidden="true" />;
}

function photoSrc(photo: ItemRead["cover_photo"]): string | null {
  if (!photo?.thumbnail_url) {
    return null;
  }

  return photo.thumbnail_url.startsWith("http") ? photo.thumbnail_url : `${API_BASE_URL}${photo.thumbnail_url}`;
}

function filteredParams(filters: ItemListFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    type: filters.type === ALL_ITEM_FILTERS ? undefined : filters.type,
    brand: filters.brand === ALL_ITEM_FILTERS ? undefined : filters.brand,
    status: filters.status === ALL_ITEM_FILTERS ? undefined : filters.status,
    mount: filters.type === "lens" && filters.mount !== ALL_ITEM_FILTERS ? filters.mount : undefined,
    camera_type:
      filters.type === "camera" && filters.camera_type !== ALL_ITEM_FILTERS ? filters.camera_type : undefined,
    sort: "catalog",
    page_size: PAGE_SIZE
  };
}

function ItemCard({ item, returnHref }: { item: ItemRead; returnHref: string }) {
  const thumbnail = photoSrc(item.cover_photo);

  return (
    <Link
      href={itemDetailHref(item.id, returnHref)}
      className="group block h-full min-w-0 max-w-full"
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          window.sessionStorage.setItem(itemListScrollStorageKey(returnHref), String(window.scrollY));
        }
      }}
    >
      <Card className="relative h-full w-full min-w-0 overflow-hidden transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <div className="aspect-video bg-muted">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={`${item.brand} ${item.model}`}
              width={640}
              height={360}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-background text-muted-foreground">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        <CardContent className="relative flex flex-col gap-3 p-3.5">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm text-muted-foreground">{item.brand}</div>
                <h2 className="mt-1 truncate text-[15px] font-semibold tracking-normal">{item.model}</h2>
              </div>
              <ItemTypeIcon type={item.type} className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge variant="secondary">{typeLabel(item.type)}</Badge>
              <Badge variant="outline">{statusLabel(item.status)}</Badge>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-2 rounded-lg border border-border/70 bg-background/95 p-3 opacity-0 shadow-lg backdrop-blur-sm transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 md:block dark:bg-card/95">
            <div className="space-y-2.5">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">购买 / 估值</div>
                <div className="mt-1 break-words text-sm font-medium leading-5 text-foreground">{priceSummary(item)}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">关键参数</div>
                <div className="mt-1 line-clamp-2 text-sm leading-5 text-foreground">{keyParams(item)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function KeywordFilter({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  const commitNow = (nextValue: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommit(nextValue);
  };

  return (
    <Input
      value={draft}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          onCommit(nextValue);
        }, 300);
      }}
      onBlur={() => commitNow(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commitNow(draft);
        }
      }}
      placeholder="搜索品牌、型号、昵称或序列号"
      className="pl-9"
    />
  );
}

function ItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const routeState = useMemo(() => parseItemListRoute(new URLSearchParams(searchKey)), [searchKey]);
  const { filters, page } = routeState;
  const canonicalHref = useMemo(() => itemListHref(filters, page), [filters, page]);
  const [state, setState] = useState<ItemsState>({ status: "loading", href: "", items: [], total: 0 });
  const [brands, setBrands] = useState<string[]>([]);
  const [lensMounts, setLensMounts] = useState<string[]>([]);
  const [cameraTypes, setCameraTypes] = useState<string[]>([]);

  useEffect(() => {
    const currentHref = `/items${searchKey ? `?${searchKey}` : ""}`;
    if (currentHref !== canonicalHref) {
      router.replace(canonicalHref, { scroll: false });
    }
  }, [canonicalHref, router, searchKey]);

  useEffect(() => {
    let active = true;

    getItemFacets()
      .then((facets) => {
        if (active) {
          setBrands(facets.brands);
          setLensMounts(facets.lens_mounts);
          setCameraTypes(facets.camera_types);
        }
      })
      .catch(() => {
        if (active) {
          setBrands([]);
          setLensMounts([]);
          setCameraTypes([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPages = async () => {
      try {
        const firstPage = await listItems({ ...filteredParams(filters), page: 1 });
        const availablePages = Math.max(1, Math.ceil(firstPage.total / PAGE_SIZE));
        const targetPage = Math.min(page, availablePages);
        const laterPages = [];
        for (let firstPageNumber = 2; firstPageNumber <= targetPage; firstPageNumber += 4) {
          const batchSize = Math.min(4, targetPage - firstPageNumber + 1);
          const batch = await Promise.all(
            Array.from({ length: batchSize }, (_, index) =>
              listItems({ ...filteredParams(filters), page: firstPageNumber + index })
            )
          );
          laterPages.push(...batch);
          if (!active) {
            return;
          }
        }
        if (!active) {
          return;
        }
        const effectiveHref = itemListHref(filters, targetPage);
        setState({
          status: "ready",
          href: effectiveHref,
          items: [firstPage, ...laterPages].flatMap((response) => response.items),
          total: firstPage.total
        });
        if (targetPage !== page) {
          router.replace(effectiveHref, { scroll: false });
        }
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        setState({
          status: "error",
          href: canonicalHref,
          items: [],
          total: 0,
          message: error instanceof Error ? error.message : "器材加载失败"
        });
      }
    };

    loadPages();

    return () => {
      active = false;
    };
  }, [canonicalHref, filters, page, router]);

  useEffect(() => {
    if (state.status !== "ready" || state.href !== canonicalHref) {
      return;
    }
    const storageKey = itemListScrollStorageKey(canonicalHref);
    const savedValue = window.sessionStorage.getItem(storageKey);
    if (!savedValue) {
      return;
    }
    window.sessionStorage.removeItem(storageKey);
    const top = Number(savedValue);
    if (!Number.isFinite(top) || top < 0) {
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => window.scrollTo({ top, behavior: "auto" }));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [canonicalHref, state]);

  const visibleState: ItemsState = state.href === canonicalHref
    ? state
    : { status: "loading", href: canonicalHref, items: [], total: 0 };

  const hasActiveFilters = useMemo(
    () =>
      filters.keyword.trim() !== "" ||
      filters.type !== ALL_ITEM_FILTERS ||
      filters.brand !== ALL_ITEM_FILTERS ||
      filters.status !== ALL_ITEM_FILTERS ||
      filters.mount !== ALL_ITEM_FILTERS ||
      filters.camera_type !== ALL_ITEM_FILTERS,
    [filters]
  );

  const updateFilter = (key: keyof ItemListFilters, value: string) => {
    const next = { ...filters, [key]: value };
    if (key === "type") {
      if (value !== "lens") {
        next.mount = ALL_ITEM_FILTERS;
      }
      if (value !== "camera") {
        next.camera_type = ALL_ITEM_FILTERS;
      }
    }
    router.replace(itemListHref(next, 1), { scroll: false });
  };

  const clearFilters = () => {
    router.replace(itemListHref(DEFAULT_ITEM_FILTERS), { scroll: false });
  };

  const loadMore = () => {
    if (visibleState.status !== "ready" || visibleState.items.length >= visibleState.total) {
      return;
    }
    router.replace(itemListHref(filters, page + 1), { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">器材</h1>
          <p className="mt-1 text-sm text-muted-foreground">器材列表</p>
        </div>
        <Button asChild>
          <Link href="/items/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            新增器材
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap">
          <div className="relative xl:min-w-[220px] xl:flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <KeywordFilter
              key={filters.keyword}
              value={filters.keyword}
              onCommit={(value) => updateFilter("keyword", value)}
            />
          </div>

          <Select value={filters.type} onValueChange={(value) => updateFilter("type", value)}>
            <SelectTrigger aria-label="类型筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filters.type === "lens" ? (
            <Select value={filters.mount} onValueChange={(value) => updateFilter("mount", value)}>
              <SelectTrigger aria-label="镜头卡口筛选" className="xl:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ITEM_FILTERS}>全部卡口</SelectItem>
                {lensMounts.map((mount) => (
                  <SelectItem key={mount} value={mount}>
                    {mount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {filters.type === "camera" ? (
            <Select value={filters.camera_type} onValueChange={(value) => updateFilter("camera_type", value)}>
              <SelectTrigger aria-label="相机类型筛选" className="xl:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ITEM_FILTERS}>全部相机类型</SelectItem>
                {cameraTypes.map((cameraType) => (
                  <SelectItem key={cameraType} value={cameraType}>
                    {cameraType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={filters.brand} onValueChange={(value) => updateFilter("brand", value)}>
            <SelectTrigger aria-label="品牌筛选" className="xl:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEM_FILTERS}>全部品牌</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger aria-label="状态筛选" className="xl:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className="xl:self-start">
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            清除
          </Button>
        </div>
      </div>

      {visibleState.status === "error" ? (
        <div className="rounded-lg border border-destructive/40 px-4 py-6 text-sm text-destructive">{visibleState.message}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{visibleState.status === "loading" ? "正在加载器材..." : `已显示 ${visibleState.items.length} / ${visibleState.total} 件器材`}</span>
      </div>

      {visibleState.status === "loading" && visibleState.items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="w-full min-w-0 overflow-hidden">
              <div className="aspect-video bg-muted" />
              <CardContent className="space-y-3 p-3.5">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-5 w-28 rounded bg-muted" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-14 rounded bg-muted" />
                  <div className="h-5 w-16 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {visibleState.status !== "loading" && visibleState.items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-base font-medium tracking-normal">暂无器材</h2>
          <p className="mt-1 text-sm text-muted-foreground">{hasActiveFilters ? "没有符合筛选条件的器材。" : "添加器材后，这里会显示列表。"}</p>
        </div>
      ) : null}

      {visibleState.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleState.items.map((item) => (
            <ItemCard key={item.id} item={item} returnHref={canonicalHref} />
          ))}
        </div>
      ) : null}

      {visibleState.status === "ready" && visibleState.items.length < visibleState.total ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore}>
            加载更多
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="min-h-64 rounded-lg border bg-muted/30" />}>
      <ItemsPageContent />
    </Suspense>
  );
}
