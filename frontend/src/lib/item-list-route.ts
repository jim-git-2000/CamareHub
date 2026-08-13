export type ItemListFilters = {
  keyword: string;
  type: string;
  brand: string;
  status: string;
  mount: string;
  camera_type: string;
};

export type ItemListRouteState = {
  filters: ItemListFilters;
  page: number;
};

export const ALL_ITEM_FILTERS = "all";
export const DEFAULT_ITEM_FILTERS: ItemListFilters = {
  keyword: "",
  type: ALL_ITEM_FILTERS,
  brand: ALL_ITEM_FILTERS,
  status: ALL_ITEM_FILTERS,
  mount: ALL_ITEM_FILTERS,
  camera_type: ALL_ITEM_FILTERS
};

const allowedTypes = new Set(["camera", "lens", "film", "accessory"]);
const allowedStatuses = new Set(["owned", "sold", "wishlist"]);
const MAX_TEXT_LENGTH = 200;
const MAX_RESTORED_PAGE = 500;

function textParam(params: URLSearchParams, name: string): string {
  return (params.get(name) ?? "").trim().slice(0, MAX_TEXT_LENGTH);
}

function enumParam(params: URLSearchParams, name: string, allowed: Set<string>): string {
  const value = params.get(name);
  return value && allowed.has(value) ? value : ALL_ITEM_FILTERS;
}

function pageParam(params: URLSearchParams): number {
  const rawValue = params.get("page");
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return 1;
  }
  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_RESTORED_PAGE ? value : 1;
}

export function parseItemListRoute(params: URLSearchParams): ItemListRouteState {
  const type = enumParam(params, "type", allowedTypes);
  return {
    filters: {
      keyword: textParam(params, "keyword"),
      type,
      brand: textParam(params, "brand") || ALL_ITEM_FILTERS,
      status: enumParam(params, "status", allowedStatuses),
      mount: type === "lens" ? textParam(params, "mount") || ALL_ITEM_FILTERS : ALL_ITEM_FILTERS,
      camera_type:
        type === "camera" ? textParam(params, "camera_type") || ALL_ITEM_FILTERS : ALL_ITEM_FILTERS
    },
    page: pageParam(params)
  };
}

export function itemListHref(filters: ItemListFilters, page = 1): string {
  const params = new URLSearchParams();
  const keyword = filters.keyword.trim();
  if (keyword) params.set("keyword", keyword);
  if (filters.type !== ALL_ITEM_FILTERS) params.set("type", filters.type);
  if (filters.brand !== ALL_ITEM_FILTERS) params.set("brand", filters.brand);
  if (filters.status !== ALL_ITEM_FILTERS) params.set("status", filters.status);
  if (filters.type === "lens" && filters.mount !== ALL_ITEM_FILTERS) params.set("mount", filters.mount);
  if (filters.type === "camera" && filters.camera_type !== ALL_ITEM_FILTERS) {
    params.set("camera_type", filters.camera_type);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/items${query ? `?${query}` : ""}`;
}

export function itemDetailHref(itemId: number, returnHref: string): string {
  const params = new URLSearchParams({ from: returnHref });
  return `/items/${itemId}?${params.toString()}`;
}

export function safeItemListReturnHref(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/items";
  }
  try {
    const url = new URL(rawValue, "http://camerahub.local");
    if (url.origin !== "http://camerahub.local" || url.pathname !== "/items" || url.hash) {
      return "/items";
    }
    const state = parseItemListRoute(url.searchParams);
    return itemListHref(state.filters, state.page);
  } catch {
    return "/items";
  }
}

export function withItemReturnHref(pathname: string, returnHref: string): string {
  const params = new URLSearchParams({ from: safeItemListReturnHref(returnHref) });
  return `${pathname}?${params.toString()}`;
}

export function itemListScrollStorageKey(returnHref: string): string {
  return `camerahub:item-list-scroll:${safeItemListReturnHref(returnHref)}`;
}
