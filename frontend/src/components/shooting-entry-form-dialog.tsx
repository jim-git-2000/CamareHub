"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createShootingEntry, updateShootingEntry } from "@/lib/api";
import type { ItemRead, ShootingEntryItemLink, ShootingEntryRead } from "@/types";

type EntryFormValues = {
  title: string;
  date: string;
  location: string;
  notes: string;
  cameraItemId: string;
  filmItemId: string;
  lensItemIds: number[];
  otherItemIds: number[];
};

const noneValue = "none";

function itemLabel(item: ItemRead): string {
  return `${item.brand} ${item.model}`;
}

function defaultFormValues(entry?: ShootingEntryRead): EntryFormValues {
  const links = entry?.item_links ?? [];
  return {
    title: entry?.title ?? "",
    date: entry?.date ?? "",
    location: entry?.location ?? "",
    notes: entry?.notes ?? "",
    cameraItemId: String(links.find((link) => link.role === "camera")?.item_id ?? noneValue),
    filmItemId: String(links.find((link) => link.role === "film")?.item_id ?? noneValue),
    lensItemIds: links.filter((link) => link.role === "lens").map((link) => link.item_id),
    otherItemIds: links.filter((link) => link.role === "other").map((link) => link.item_id)
  };
}

function buildItemLinks(values: EntryFormValues): ShootingEntryItemLink[] {
  const links: ShootingEntryItemLink[] = [];

  if (values.cameraItemId !== noneValue) {
    links.push({ item_id: Number(values.cameraItemId), role: "camera" });
  }
  if (values.filmItemId !== noneValue) {
    links.push({ item_id: Number(values.filmItemId), role: "film" });
  }
  values.lensItemIds.forEach((itemId) => links.push({ item_id: itemId, role: "lens" }));
  values.otherItemIds.forEach((itemId) => links.push({ item_id: itemId, role: "other" }));

  return links;
}

function itemGroups(items: ItemRead[]) {
  return {
    cameras: items.filter((item) => item.type === "camera"),
    lenses: items.filter((item) => item.type === "lens"),
    films: items.filter((item) => item.type === "film"),
    others: items.filter((item) => !["camera", "lens", "film"].includes(item.type))
  };
}

function toggleNumber(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ShootingEntryFormDialog({
  open,
  entry,
  items,
  onOpenChange,
  onSaved
}: {
  open: boolean;
  entry: ShootingEntryRead | null;
  items: ItemRead[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<EntryFormValues>(() => defaultFormValues(entry ?? undefined));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => itemGroups(items), [items]);

  useEffect(() => {
    if (open) {
      setValues(defaultFormValues(entry ?? undefined));
      setTitleError(null);
      setSubmitError(null);
    }
  }, [entry, open]);

  const setValue = (key: keyof EntryFormValues, value: EntryFormValues[typeof key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.title.trim()) {
      setTitleError("请输入标题");
      return;
    }

    setSaving(true);
    setSubmitError(null);
    setTitleError(null);

    try {
      const payload = {
        title: values.title.trim(),
        date: values.date || null,
        location: values.location.trim() || null,
        notes: values.notes.trim() || null,
        item_links: buildItemLinks(values)
      };

      if (entry) {
        await updateShootingEntry(entry.id, payload);
      } else {
        await createShootingEntry(payload);
      }

      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entry ? "编辑拍摄事项" : "新增拍摄事项"}</DialogTitle>
          <DialogDescription>记录一次拍摄，并关联已有相机、镜头、胶片或其他器材。</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {submitError ? <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{submitError}</div> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">标题 <span className="text-destructive">*</span></span>
              <Input value={values.title} onChange={(event) => setValue("title", event.target.value)} />
              {titleError ? <span className="block text-xs text-destructive">{titleError}</span> : null}
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">日期</span>
              <Input type="date" value={values.date} onChange={(event) => setValue("date", event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">地点</span>
              <Input value={values.location} onChange={(event) => setValue("location", event.target.value)} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">备注</span>
              <Textarea value={values.notes} onChange={(event) => setValue("notes", event.target.value)} rows={3} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">相机</span>
              <Select value={values.cameraItemId} onValueChange={(value) => setValue("cameraItemId", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>不关联相机</SelectItem>
                  {groups.cameras.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {itemLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">胶片</span>
              <Select value={values.filmItemId} onValueChange={(value) => setValue("filmItemId", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>不关联胶片</SelectItem>
                  {groups.films.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {itemLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-medium">镜头</div>
              <div className="space-y-2">
                {groups.lenses.length === 0 ? <p className="text-sm text-muted-foreground">暂无镜头</p> : null}
                {groups.lenses.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.lensItemIds.includes(item.id)}
                      onChange={() => setValue("lensItemIds", toggleNumber(values.lensItemIds, item.id))}
                      className="h-4 w-4 rounded border-input"
                    />
                    {itemLabel(item)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-medium">其他器材</div>
              <div className="space-y-2">
                {groups.others.length === 0 ? <p className="text-sm text-muted-foreground">暂无其他器材</p> : null}
                {groups.others.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.otherItemIds.includes(item.id)}
                      onChange={() => setValue("otherItemIds", toggleNumber(values.otherItemIds, item.id))}
                      className="h-4 w-4 rounded border-input"
                    />
                    {itemLabel(item)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">关联设备可选，建议至少选择一个相机或镜头。</p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
