import type {
  ApiErrorResponse,
  HealthResponse,
  ItemListResponse,
  ItemMutationPayload,
  ItemRead,
  PhotoRead,
  StatsSummary,
  TransactionRead
} from "@/types";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse;
    const message = errorPayload.detail ?? errorPayload.message ?? response.statusText;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function apiRequest<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: init?.signal ?? controller.signal
    });

    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(`API request timed out: ${url}`, 0);
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/api/health");
}

type ListItemsParams = {
  type?: string;
  brand?: string;
  status?: string;
  mount?: string;
  keyword?: string;
  sort?: string;
  page?: number;
  page_size?: number;
};

function toQueryString(params: ListItemsParams): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  return query.toString();
}

export function listItems(params: ListItemsParams = {}): Promise<ItemListResponse> {
  const query = toQueryString(params);
  return apiRequest<ItemListResponse>(`/api/items${query ? `?${query}` : ""}`);
}

export function getItem(itemId: number): Promise<ItemRead> {
  return apiRequest<ItemRead>(`/api/items/${itemId}`);
}

export function createItem(payload: ItemMutationPayload): Promise<ItemRead> {
  return apiRequest<ItemRead>("/api/items", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateItem(itemId: number, payload: ItemMutationPayload): Promise<ItemRead> {
  return apiRequest<ItemRead>(`/api/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteItem(itemId: number): Promise<void> {
  return apiRequest<void>(`/api/items/${itemId}`, { method: "DELETE" });
}

export function listItemPhotos(itemId: number): Promise<PhotoRead[]> {
  return apiRequest<PhotoRead[]>(`/api/items/${itemId}/photos`);
}

export function uploadItemPhoto(itemId: number, file: File): Promise<PhotoRead> {
  const formData = new FormData();
  formData.set("file", file);

  return apiRequest<PhotoRead>(`/api/items/${itemId}/photos`, {
    method: "POST",
    body: formData
  });
}

export function deletePhoto(photoId: number): Promise<void> {
  return apiRequest<void>(`/api/photos/${photoId}`, { method: "DELETE" });
}

export function listItemTransactions(itemId: number): Promise<TransactionRead[]> {
  return apiRequest<TransactionRead[]>(`/api/items/${itemId}/transactions`);
}

export function getStatsSummary(): Promise<StatsSummary> {
  return apiRequest<StatsSummary>("/api/stats/summary");
}
