"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ItemMutationPayload, ItemRead } from "@/types";

type ItemFormProps = {
  mode: "create" | "edit";
  initialItem?: ItemRead;
  cancelHref?: string;
  onSubmit: (payload: ItemMutationPayload) => Promise<void>;
};

type BaseValues = {
  type: string;
  brand: string;
  model: string;
  nickname: string;
  serial_number: string;
  status: string;
  purchase_date: string;
  purchase_price: string;
  current_value: string;
  currency: string;
  condition: string;
  location: string;
  notes: string;
  custom_fields: string;
};

type CameraValues = {
  mount: string;
  format: string;
  camera_type: string;
  film_format: string;
  sensor_type: string;
  megapixels: string;
  shutter_type: string;
  metering: string;
  battery_type: string;
  weight_g: string;
};

type LensValues = {
  mount: string;
  focal_length_min: string;
  focal_length_max: string;
  aperture_max: string;
  aperture_min: string;
  filter_size_mm: string;
  minimum_focus_m: string;
  stabilization: boolean;
  autofocus: boolean;
  weight_g: string;
};

type FilmValues = {
  iso: string;
  film_format: string;
  color_type: string;
  process: string;
  expiry_date: string;
  quantity: string;
  storage_location: string;
};

const typeOptions = [
  { value: "camera", label: "相机" },
  { value: "lens", label: "镜头" },
  { value: "film", label: "胶片" },
  { value: "accessory", label: "配件" }
];

const statusOptions = [
  { value: "owned", label: "持有" },
  { value: "sold", label: "已出售" },
  { value: "wishlist", label: "愿望清单" }
];

const conditionOptions = [
  { value: "new", label: "全新" },
  { value: "excellent", label: "优秀" },
  { value: "good", label: "良好" },
  { value: "fair", label: "一般" },
  { value: "poor", label: "较差" },
  { value: "unknown", label: "未知" }
];

function textValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultBaseValues(item?: ItemRead): BaseValues {
  return {
    type: item?.type || "camera",
    brand: item?.brand || "",
    model: item?.model || "",
    nickname: item?.nickname || "",
    serial_number: item?.serial_number || "",
    status: item?.status || "owned",
    purchase_date: item?.purchase_date || "",
    purchase_price: textValue(item?.purchase_price),
    current_value: textValue(item?.current_value),
    currency: item?.currency || "CNY",
    condition: item?.condition || "unknown",
    location: item?.location || "",
    notes: item?.notes || "",
    custom_fields: item?.custom_fields || ""
  };
}

function defaultCameraValues(item?: ItemRead): CameraValues {
  return {
    mount: item?.camera?.mount || "",
    format: item?.camera?.format || "",
    camera_type: item?.camera?.camera_type || "",
    film_format: item?.camera?.film_format || "",
    sensor_type: item?.camera?.sensor_type || "",
    megapixels: textValue(item?.camera?.megapixels),
    shutter_type: item?.camera?.shutter_type || "",
    metering: item?.camera?.metering || "",
    battery_type: item?.camera?.battery_type || "",
    weight_g: textValue(item?.camera?.weight_g)
  };
}

function defaultLensValues(item?: ItemRead): LensValues {
  return {
    mount: item?.lens?.mount || "",
    focal_length_min: textValue(item?.lens?.focal_length_min),
    focal_length_max: textValue(item?.lens?.focal_length_max),
    aperture_max: textValue(item?.lens?.aperture_max),
    aperture_min: textValue(item?.lens?.aperture_min),
    filter_size_mm: textValue(item?.lens?.filter_size_mm),
    minimum_focus_m: textValue(item?.lens?.minimum_focus_m),
    stabilization: item?.lens?.stabilization ?? false,
    autofocus: item?.lens?.autofocus ?? false,
    weight_g: textValue(item?.lens?.weight_g)
  };
}

function defaultFilmValues(item?: ItemRead): FilmValues {
  return {
    iso: textValue(item?.film?.iso),
    film_format: item?.film?.film_format || "",
    color_type: item?.film?.color_type || "",
    process: item?.film?.process || "",
    expiry_date: item?.film?.expiry_date || "",
    quantity: textValue(item?.film?.quantity),
    storage_location: item?.film?.storage_location || ""
  };
}

function Field({
  label,
  children,
  required = false,
  error
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
  required
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ItemForm({ mode, initialItem, cancelHref, onSubmit }: ItemFormProps) {
  const [base, setBase] = useState<BaseValues>(() => defaultBaseValues(initialItem));
  const [camera, setCamera] = useState<CameraValues>(() => defaultCameraValues(initialItem));
  const [lens, setLens] = useState<LensValues>(() => defaultLensValues(initialItem));
  const [film, setFilm] = useState<FilmValues>(() => defaultFilmValues(initialItem));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentValueManuallyEdited, setCurrentValueManuallyEdited] = useState(
    () => mode === "edit" && initialItem?.current_value !== null && initialItem?.current_value !== undefined
  );

  const title = useMemo(() => (mode === "create" ? "新增器材" : "编辑器材"), [mode]);

  const setBaseValue = (key: keyof BaseValues, value: string) => {
    setBase((current) => ({ ...current, [key]: value }));
  };

  const setPurchasePrice = (value: string) => {
    setBase((current) => ({
      ...current,
      purchase_price: value,
      current_value: currentValueManuallyEdited ? current.current_value : value
    }));
  };

  const setCurrentValue = (value: string) => {
    setCurrentValueManuallyEdited(true);
    setBaseValue("current_value", value);
  };

  const setCameraValue = (key: keyof CameraValues, value: string) => {
    setCamera((current) => ({ ...current, [key]: value }));
  };

  const setLensValue = (key: keyof LensValues, value: string | boolean) => {
    setLens((current) => ({ ...current, [key]: value }));
  };

  const setFilmValue = (key: keyof FilmValues, value: string) => {
    setFilm((current) => ({ ...current, [key]: value }));
  };

  const buildPayload = (): ItemMutationPayload | null => {
    const nextErrors: Record<string, string> = {};

    if (!base.type) {
      nextErrors.type = "请选择类型";
    }
    if (!base.brand.trim()) {
      nextErrors.brand = "请输入品牌";
    }
    if (!base.model.trim()) {
      nextErrors.model = "请输入型号";
    }

    if (base.custom_fields.trim()) {
      try {
        JSON.parse(base.custom_fields);
      } catch {
        nextErrors.custom_fields = "请输入有效 JSON";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    const payload: ItemMutationPayload = {
      type: base.type,
      brand: base.brand.trim(),
      model: base.model.trim(),
      nickname: optionalText(base.nickname),
      serial_number: optionalText(base.serial_number),
      status: base.status,
      purchase_date: optionalText(base.purchase_date),
      purchase_price: optionalNumber(base.purchase_price),
      current_value: optionalNumber(base.current_value),
      currency: base.currency.trim() || "CNY",
      condition: base.condition,
      location: optionalText(base.location),
      notes: optionalText(base.notes),
      custom_fields: optionalText(base.custom_fields)
    };

    if (base.type === "camera") {
      payload.camera = {
        mount: optionalText(camera.mount),
        format: optionalText(camera.format),
        camera_type: optionalText(camera.camera_type),
        film_format: optionalText(camera.film_format),
        sensor_type: optionalText(camera.sensor_type),
        megapixels: optionalNumber(camera.megapixels),
        shutter_type: optionalText(camera.shutter_type),
        metering: optionalText(camera.metering),
        battery_type: optionalText(camera.battery_type),
        weight_g: optionalNumber(camera.weight_g)
      };
    }

    if (base.type === "lens") {
      payload.lens = {
        mount: optionalText(lens.mount),
        focal_length_min: optionalNumber(lens.focal_length_min),
        focal_length_max: optionalNumber(lens.focal_length_max),
        aperture_max: optionalNumber(lens.aperture_max),
        aperture_min: optionalNumber(lens.aperture_min),
        filter_size_mm: optionalNumber(lens.filter_size_mm),
        minimum_focus_m: optionalNumber(lens.minimum_focus_m),
        stabilization: lens.stabilization,
        autofocus: lens.autofocus,
        weight_g: optionalNumber(lens.weight_g)
      };
    }

    if (base.type === "film") {
      payload.film = {
        iso: optionalNumber(film.iso),
        film_format: optionalText(film.film_format),
        color_type: optionalText(film.color_type),
        process: optionalText(film.process),
        expiry_date: optionalText(film.expiry_date),
        quantity: optionalNumber(film.quantity),
        storage_location: optionalText(film.storage_location)
      };
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      await onSubmit(payload);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-4 mb-2">
            <Link href={cancelHref ?? (initialItem ? `/items/${initialItem.id}` : "/items")}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              返回
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "create" ? "创建新的摄影器材记录" : "更新器材信息"}</p>
        </div>

        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {submitError ? <div className="rounded-md border border-destructive/40 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SelectField label="类型" value={base.type} onValueChange={(value) => setBaseValue("type", value)} options={typeOptions} required />
          <SelectField
            label="状态"
            value={base.status}
            onValueChange={(value) => setBaseValue("status", value)}
            options={statusOptions}
          />
          <Field label="品牌" required error={errors.brand}>
            <Input value={base.brand} onChange={(event) => setBaseValue("brand", event.target.value)} />
          </Field>
          <Field label="型号" required error={errors.model}>
            <Input value={base.model} onChange={(event) => setBaseValue("model", event.target.value)} />
          </Field>
          <Field label="昵称">
            <Input value={base.nickname} onChange={(event) => setBaseValue("nickname", event.target.value)} />
          </Field>
          <Field label="序列号">
            <Input value={base.serial_number} onChange={(event) => setBaseValue("serial_number", event.target.value)} />
          </Field>
          <Field label="购买日期">
            <Input type="date" value={base.purchase_date} onChange={(event) => setBaseValue("purchase_date", event.target.value)} />
          </Field>
          <Field label={base.type === "film" ? "购买价格（单卷）" : "购买价格"}>
            <Input type="number" step="0.01" value={base.purchase_price} onChange={(event) => setPurchasePrice(event.target.value)} />
          </Field>
          <Field label={base.type === "film" ? "当前估值（单卷，可选手动调整）" : "当前估值（可选手动调整）"}>
            <Input type="number" step="0.01" value={base.current_value} onChange={(event) => setCurrentValue(event.target.value)} />
          </Field>
          <Field label="币种">
            <Input value={base.currency} onChange={(event) => setBaseValue("currency", event.target.value.toUpperCase())} />
          </Field>
          <SelectField
            label="成色"
            value={base.condition}
            onValueChange={(value) => setBaseValue("condition", value)}
            options={conditionOptions}
          />
          <Field label="存放位置">
            <Input value={base.location} onChange={(event) => setBaseValue("location", event.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {base.type === "camera" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">相机字段</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="卡口">
              <Input value={camera.mount} onChange={(event) => setCameraValue("mount", event.target.value)} />
            </Field>
            <Field label="画幅">
              <Input value={camera.format} onChange={(event) => setCameraValue("format", event.target.value)} />
            </Field>
            <Field label="相机类型">
              <Input value={camera.camera_type} onChange={(event) => setCameraValue("camera_type", event.target.value)} />
            </Field>
            <Field label="胶片规格">
              <Input value={camera.film_format} onChange={(event) => setCameraValue("film_format", event.target.value)} />
            </Field>
            <Field label="传感器类型">
              <Input value={camera.sensor_type} onChange={(event) => setCameraValue("sensor_type", event.target.value)} />
            </Field>
            <Field label="像素 MP">
              <Input type="number" step="0.1" value={camera.megapixels} onChange={(event) => setCameraValue("megapixels", event.target.value)} />
            </Field>
            <Field label="快门类型">
              <Input value={camera.shutter_type} onChange={(event) => setCameraValue("shutter_type", event.target.value)} />
            </Field>
            <Field label="测光">
              <Input value={camera.metering} onChange={(event) => setCameraValue("metering", event.target.value)} />
            </Field>
            <Field label="电池">
              <Input value={camera.battery_type} onChange={(event) => setCameraValue("battery_type", event.target.value)} />
            </Field>
            <Field label="重量 g">
              <Input type="number" step="0.1" value={camera.weight_g} onChange={(event) => setCameraValue("weight_g", event.target.value)} />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {base.type === "lens" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">镜头字段</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="卡口">
              <Input value={lens.mount} onChange={(event) => setLensValue("mount", event.target.value)} />
            </Field>
            <Field label="最短焦距 mm">
              <Input type="number" step="0.1" value={lens.focal_length_min} onChange={(event) => setLensValue("focal_length_min", event.target.value)} />
            </Field>
            <Field label="最长焦距 mm">
              <Input type="number" step="0.1" value={lens.focal_length_max} onChange={(event) => setLensValue("focal_length_max", event.target.value)} />
            </Field>
            <Field label="最大光圈">
              <Input type="number" step="0.1" value={lens.aperture_max} onChange={(event) => setLensValue("aperture_max", event.target.value)} />
            </Field>
            <Field label="最小光圈">
              <Input type="number" step="0.1" value={lens.aperture_min} onChange={(event) => setLensValue("aperture_min", event.target.value)} />
            </Field>
            <Field label="滤镜尺寸 mm">
              <Input type="number" step="0.1" value={lens.filter_size_mm} onChange={(event) => setLensValue("filter_size_mm", event.target.value)} />
            </Field>
            <Field label="最近对焦 m">
              <Input type="number" step="0.01" value={lens.minimum_focus_m} onChange={(event) => setLensValue("minimum_focus_m", event.target.value)} />
            </Field>
            <Field label="重量 g">
              <Input type="number" step="0.1" value={lens.weight_g} onChange={(event) => setLensValue("weight_g", event.target.value)} />
            </Field>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lens.stabilization}
                onChange={(event) => setLensValue("stabilization", event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              防抖
            </label>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lens.autofocus}
                onChange={(event) => setLensValue("autofocus", event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              自动对焦
            </label>
          </CardContent>
        </Card>
      ) : null}

      {base.type === "film" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">胶片字段</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="ISO">
              <Input type="number" step="1" value={film.iso} onChange={(event) => setFilmValue("iso", event.target.value)} />
            </Field>
            <Field label="胶片规格">
              <Input value={film.film_format} onChange={(event) => setFilmValue("film_format", event.target.value)} />
            </Field>
            <Field label="色彩类型">
              <Input value={film.color_type} onChange={(event) => setFilmValue("color_type", event.target.value)} />
            </Field>
            <Field label="冲洗工艺">
              <Input value={film.process} onChange={(event) => setFilmValue("process", event.target.value)} />
            </Field>
            <Field label="有效期">
              <Input type="date" value={film.expiry_date} onChange={(event) => setFilmValue("expiry_date", event.target.value)} />
            </Field>
            <Field label="数量">
              <Input type="number" step="1" value={film.quantity} onChange={(event) => setFilmValue("quantity", event.target.value)} />
            </Field>
            <Field label="存储位置">
              <Input value={film.storage_location} onChange={(event) => setFilmValue("storage_location", event.target.value)} />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">备注与自定义字段</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="备注">
            <Textarea value={base.notes} onChange={(event) => setBaseValue("notes", event.target.value)} rows={4} />
          </Field>
          <Field label="自定义字段 JSON" error={errors.custom_fields}>
            <Textarea value={base.custom_fields} onChange={(event) => setBaseValue("custom_fields", event.target.value)} rows={6} />
          </Field>
        </CardContent>
      </Card>
    </form>
  );
}
