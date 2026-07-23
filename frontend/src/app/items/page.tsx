"use client";

import Link from "next/link";
import { Aperture, Camera, Film, ImageIcon, Package, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, listItemPhotos, listItems } from "@/lib/api";
import type { ItemRead, PhotoRead } from "@/types";

type ItemFilters = {
  keyword: string;
  type: string;
  brand: string;
  status: string;
  mount: string;
  camera_type: string;
};

type ItemsState =
  | { status: "loading"; items: ItemRead[] }
  | { status: "ready"; items: ItemRead[] }
  | { status: "error"; items: ItemRead[]; message: string };

const ALL_VALUE = "all";
const PAGE_SIZE = 100;

const defaultFilters: ItemFilters = {
  keyword: "",
  type: ALL_VALUE,
  brand: ALL_VALUE,
  status: ALL_VALUE,
  mount: ALL_VALUE,
  camera_type: ALL_VALUE
};

const typeOptions = [
  { value: ALL_VALUE, label: "全部类型" },
  { value: "camera", label: "相机" },
  { value: "lens", label: "镜头" },
  { value: "film", label: "胶片" },
  { value: "accessory", label: "配件" }
];

const statusOptions = [
  { value: ALL_VALUE, label: "全部状态" },
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

function itemIcon(type: string) {
  if (type === "camera") {
    return Camera;
  }

  if (type === "lens") {
    return Aperture;
  }

  if (type === "film") {
    return Film;
  }

  return Package;
}

function photoSrc(photo: PhotoRead | null | undefined): string | null {
  if (!photo?.thumbnail_url) {
    return null;
  }

  return photo.thumbnail_url.startsWith("http") ? photo.thumbnail_url : `${API_BASE_URL}${photo.thumbnail_url}`;
}

async function fetchAllFilteredItems(filters: ItemFilters): Promise<ItemRead[]> {
  const params = {
    keyword: filters.keyword.trim() || undefined,
    type: filters.type === ALL_VALUE ? undefined : filters.type,
    brand: filters.brand === ALL_VALUE ? undefined : filters.brand,
    status: filters.status === ALL_VALUE ? undefined : filters.status,
    mount: filters.type === "lens" && filters.mount !== ALL_VALUE ? filters.mount : undefined,
    camera_type: filters.type === "camera" && filters.camera_type !== ALL_VALUE ? filters.camera_type : undefined,
    sort: "catalog",
    page: 1,
    page_size: PAGE_SIZE
  };

  const firstPage = await listItems(params);
  const items = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / PAGE_SIZE);

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listItems({ ...params, page });
    items.push(...response.items);
  }

  return items;
}

function distinctFieldValues(values: Array<string | null | undefined>): string[] {
  const options = new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)));
  return Array.from(options).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function fetchFilterOptions(): Promise<{ brands: string[]; lensMounts: string[]; cameraTypes: string[] }> {
  const items = await fetchAllFilteredItems(defaultFilters);

  return {
    brands: Array.from(new Set(items.map((item) => item.brand).filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    lensMounts: distinctFieldValues(items.filter((item) => item.type === "lens").map((item) => item.lens?.mount)),
    cameraTypes: distinctFieldValues(items.filter((item) => item.type === "camera").map((item) => item.camera?.camera_type))
  };
}

async function fetchThumbnails(items: ItemRead[]): Promise<Record<number, PhotoRead | null>> {
  const entries = await Promise.all(
    items.map(async (item) => {
      try {
        const photos = await listItemPhotos(item.id);
        return [item.id, photos[0] ?? null] as const;
      } catch {
        return [item.id, null] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

function ItemCard({ item, photo }: { item: ItemRead; photo?: PhotoRead | null }) {
  const Icon = itemIcon(item.type);
  const thumbnail = photoSrc(photo);

  return (
    <Link href={`/items/${item.id}`} className="group block h-full min-w-0 max-w-full">
      <Card className="relative h-full w-full min-w-0 overflow-hidden transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <div className="aspect-video bg-muted">
          {thumbnail ? (
            <img src={thumbnail} alt={`${item.brand} ${item.model}`} className="h-full w-full object-cover" />
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
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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

export default function ItemsPage() {
  const [filters, setFilters] = useState<ItemFilters>(defaultFilters);
  const [state, setState] = useState<ItemsState>({ status: "loading", items: [] });
  const [brands, setBrands] = useState<string[]>([]);
  const [lensMounts, setLensMounts] = useState<string[]>([]);
  const [cameraTypes, setCameraTypes] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, PhotoRead | null>>({});

  useEffect(() => {
    let active = true;

    fetchFilterOptions()
      .then(({ brands: nextBrands, lensMounts: nextLensMounts, cameraTypes: nextCameraTypes }) => {
        if (active) {
          setBrands(nextBrands);
          setLensMounts(nextLensMounts);
          setCameraTypes(nextCameraTypes);
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

    setState((current) => ({ status: "loading", items: current.items }));

    fetchAllFilteredItems(filters)
      .then(async (items) => {
        const nextThumbnails = await fetchThumbnails(items);

        if (!active) {
          return;
        }

        setThumbnails(nextThumbnails);
        setState({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setThumbnails({});
        setState({
          status: "error",
          items: [],
          message: error instanceof Error ? error.message : "器材加载失败"
        });
      });

    return () => {
      active = false;
    };
  }, [filters]);

  const hasActiveFilters = useMemo(
    () =>
      filters.keyword.trim() !== "" ||
      filters.type !== ALL_VALUE ||
      filters.brand !== ALL_VALUE ||
      filters.status !== ALL_VALUE ||
      filters.mount !== ALL_VALUE ||
      filters.camera_type !== ALL_VALUE,
    [filters]
  );

  const updateFilter = (key: keyof ItemFilters, value: string) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "type") {
        if (value !== "lens") {
          next.mount = ALL_VALUE;
        }
        if (value !== "camera") {
          next.camera_type = ALL_VALUE;
        }
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
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
            <Input
              value={filters.keyword}
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="搜索品牌、型号、昵称或序列号"
              className="pl-9"
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
                <SelectItem value={ALL_VALUE}>全部卡口</SelectItem>
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
                <SelectItem value={ALL_VALUE}>全部相机类型</SelectItem>
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
              <SelectItem value={ALL_VALUE}>全部品牌</SelectItem>
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

      {state.status === "error" ? (
        <div className="rounded-lg border border-destructive/40 px-4 py-6 text-sm text-destructive">{state.message}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{state.status === "loading" ? "正在加载器材..." : `共 ${state.items.length} 件器材`}</span>
      </div>

      {state.status === "loading" && state.items.length === 0 ? (
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

      {state.status !== "loading" && state.items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-base font-medium tracking-normal">暂无器材</h2>
          <p className="mt-1 text-sm text-muted-foreground">{hasActiveFilters ? "没有符合筛选条件的器材。" : "添加器材后，这里会显示列表。"}</p>
        </div>
      ) : null}

      {state.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.items.map((item) => (
            <ItemCard key={item.id} item={item} photo={thumbnails[item.id]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
