export type HealthResponse = {
  status: string;
  app: string;
};

export type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

export type NavItem = {
  href: string;
  label: string;
};

export type CameraRead = {
  id: number;
  item_id: number;
  mount?: string | null;
  format?: string | null;
  camera_type?: string | null;
  film_format?: string | null;
  sensor_type?: string | null;
  megapixels?: number | null;
  shutter_type?: string | null;
  metering?: string | null;
  battery_type?: string | null;
  weight_g?: number | null;
};

export type LensRead = {
  id: number;
  item_id: number;
  mount?: string | null;
  focal_length_min?: number | null;
  focal_length_max?: number | null;
  aperture_max?: number | null;
  aperture_min?: number | null;
  filter_size_mm?: number | null;
  minimum_focus_m?: number | null;
  stabilization?: boolean | null;
  autofocus?: boolean | null;
  weight_g?: number | null;
};

export type FilmRead = {
  id: number;
  item_id: number;
  iso?: number | null;
  film_format?: string | null;
  color_type?: string | null;
  process?: string | null;
  expiry_date?: string | null;
  quantity?: number | null;
  storage_location?: string | null;
};

export type ItemRead = {
  id: number;
  type: "camera" | "lens" | "film" | "accessory" | string;
  brand: string;
  model: string;
  nickname?: string | null;
  serial_number?: string | null;
  status: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  currency: string;
  condition: string;
  location?: string | null;
  notes?: string | null;
  custom_fields?: string | null;
  created_at: string;
  updated_at: string;
  camera?: CameraRead | null;
  lens?: LensRead | null;
  film?: FilmRead | null;
};

export type CameraPayload = {
  mount?: string | null;
  format?: string | null;
  camera_type?: string | null;
  film_format?: string | null;
  sensor_type?: string | null;
  megapixels?: number | null;
  shutter_type?: string | null;
  metering?: string | null;
  battery_type?: string | null;
  weight_g?: number | null;
};

export type LensPayload = {
  mount?: string | null;
  focal_length_min?: number | null;
  focal_length_max?: number | null;
  aperture_max?: number | null;
  aperture_min?: number | null;
  filter_size_mm?: number | null;
  minimum_focus_m?: number | null;
  stabilization?: boolean | null;
  autofocus?: boolean | null;
  weight_g?: number | null;
};

export type FilmPayload = {
  iso?: number | null;
  film_format?: string | null;
  color_type?: string | null;
  process?: string | null;
  expiry_date?: string | null;
  quantity?: number | null;
  storage_location?: string | null;
};

export type ItemMutationPayload = {
  type: string;
  brand: string;
  model: string;
  nickname?: string | null;
  serial_number?: string | null;
  status?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  currency?: string | null;
  condition?: string | null;
  location?: string | null;
  notes?: string | null;
  custom_fields?: string | null;
  camera?: CameraPayload | null;
  lens?: LensPayload | null;
  film?: FilmPayload | null;
};

export type ItemListResponse = {
  items: ItemRead[];
  page: number;
  page_size: number;
  total: number;
};

export type PhotoRead = {
  id: number;
  item_id: number;
  file_path: string;
  file_name: string;
  content_type?: string | null;
  file_size?: number | null;
  sort_order: number;
  created_at: string;
  url: string;
};

export type TransactionRead = {
  id: number;
  item_id: number;
  type: string;
  amount?: number | null;
  currency: string;
  date?: string | null;
  vendor?: string | null;
  notes?: string | null;
  created_at: string;
};

export type StatsSummary = {
  total_value?: number | string | null;
  totalAssetValue?: number | string | null;
  asset_value?: number | string | null;
  current_value_total?: number | string | null;
  total_current_value?: number | string | null;
  camera_count?: number | string | null;
  cameraCount?: number | string | null;
  cameras?: number | string | null;
  lens_count?: number | string | null;
  lensCount?: number | string | null;
  lenses?: number | string | null;
  film_stock?: number | string | null;
  filmStock?: number | string | null;
  film_quantity?: number | string | null;
  filmQuantity?: number | string | null;
  recent_items?: ItemRead[] | null;
  recentItems?: ItemRead[] | null;
};
