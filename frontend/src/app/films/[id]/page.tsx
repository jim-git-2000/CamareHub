"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Edit,
  ImageIcon,
  Loader2,
  MapPin,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ShootingEntryFormDialog } from "@/components/shooting-entry-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  API_BASE_URL,
  ApiError,
  deleteShootingEntry,
  deleteShootingEntryPhoto,
  getShootingEntry,
  listItems,
  setShootingEntryCoverPhoto,
  uploadShootingEntryPhoto
} from "@/lib/api";
import type {
  ItemRead,
  ShootingEntryItemRole,
  ShootingEntryPhotoRead,
  ShootingEntryRead
} from "@/types";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; entry: ShootingEntryRead }
  | { status: "error"; message: string };

const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSizeBytes = 10 * 1024 * 1024;

function originalPhotoSrc(photo: ShootingEntryPhotoRead): string {
  return photo.url.startsWith("http") ? photo.url : `${API_BASE_URL}${photo.url}`;
}

function thumbnailPhotoSrc(photo: ShootingEntryPhotoRead): string | null {
  if (!photo.thumbnail_url) {
    return null;
  }

  return photo.thumbnail_url.startsWith("http") ? photo.thumbnail_url : `${API_BASE_URL}${photo.thumbnail_url}`;
}

function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "未填写日期";
}

function formatFileSize(value: number | null | undefined): string {
  if (!value) {
    return "未知大小";
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

export default function ShootingEntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const entryId = Number(params.id);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [items, setItems] = useState<ItemRead[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<ShootingEntryPhotoRead | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [coveringPhotoId, setCoveringPhotoId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadEntry = async () => {
    if (!Number.isInteger(entryId) || entryId <= 0) {
      setState({ status: "error", message: "无效的照片记录 ID" });
      return;
    }

    try {
      const entry = await getShootingEntry(entryId);
      setState({ status: "ready", entry });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: "error", message: "照片记录不存在或已被删除。" });
        return;
      }
      setState({ status: "error", message: error instanceof Error ? error.message : "照片记录加载失败" });
    }
  };

  useEffect(() => {
    let active = true;

    if (!Number.isInteger(entryId) || entryId <= 0) {
      setState({ status: "error", message: "无效的照片记录 ID" });
      return;
    }

    setState({ status: "loading" });
    getShootingEntry(entryId)
      .then((entry) => {
        if (active) {
          setState({ status: "ready", entry });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "error", message: "照片记录不存在或已被删除。" });
          return;
        }
        setState({ status: "error", message: error instanceof Error ? error.message : "照片记录加载失败" });
      });

    return () => {
      active = false;
    };
  }, [entryId]);

  useEffect(() => {
    listItems({ page: 1, page_size: 100, sort: "brand" })
      .then((response) => setItems(response.items))
      .catch(() => setItems([]));
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteShootingEntry(entryId);
      setDeleteOpen(false);
      router.push("/films");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || state.status !== "ready") {
      return;
    }

    if (!allowedPhotoTypes.includes(file.type)) {
      setPhotoError("仅支持 jpg、jpeg、png、webp 图片。");
      return;
    }

    if (file.size > maxPhotoSizeBytes) {
      setPhotoError("单张图片最大 10MB。");
      return;
    }

    setUploading(true);
    setPhotoError(null);

    try {
      await uploadShootingEntryPhoto(state.entry.id, file);
      await loadEntry();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) {
      return;
    }

    setDeletingPhoto(true);
    setPhotoError(null);

    try {
      await deleteShootingEntryPhoto(photoToDelete.id);
      setPhotoToDelete(null);
      await loadEntry();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "图片删除失败");
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleSetCover = async (photo: ShootingEntryPhotoRead) => {
    setCoveringPhotoId(photo.id);
    setPhotoError(null);

    try {
      await setShootingEntryCoverPhoto(photo.id);
      await loadEntry();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "封面设置失败");
    } finally {
      setCoveringPhotoId(null);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载照片记录...
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline">
          <Link href="/films">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            返回照片记录
          </Link>
        </Button>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">无法查看照片记录</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { entry } = state;
  const coverPhotoId = entry.photos[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-4 mb-2">
            <Link href="/films">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              返回照片记录
            </Link>
          </Button>
          <h1 className="break-words text-2xl font-semibold tracking-normal">{entry.title}</h1>
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

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setFormOpen(true)}>
            <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
            编辑
          </Button>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">关联设备</CardTitle>
        </CardHeader>
        <CardContent>
          {entry.item_links.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">未关联设备</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.item_links.map((link) => (
                <Badge key={link.id} variant="secondary" className="gap-1">
                  {roleLabel(link.role)}:
                  <Link href={`/items/${link.item_id}`} className="hover:underline">
                    {itemLabel(link.item)}
                  </Link>
                </Badge>
              ))}
            </div>
          )}

          {entry.notes ? (
            <div className="mt-4 rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">备注</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{entry.notes}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">照片</CardTitle>
              <CardDescription>第一张照片会作为列表封面，可在下方指定封面</CardDescription>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {uploading ? "上传中..." : "上传图片"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {photoError ? <div className="mb-4 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{photoError}</div> : null}
          {entry.photos.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
              <ImageIcon className="mb-2 h-7 w-7" aria-hidden="true" />
              暂无图片
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entry.photos.map((photo) => {
                const isCover = photo.id === coverPhotoId;
                const thumbnail = thumbnailPhotoSrc(photo);

                return (
                  <div key={photo.id} className="overflow-hidden rounded-md border">
                    <a href={originalPhotoSrc(photo)} target="_blank" rel="noreferrer" className="group block">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={photo.file_name}
                          className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-90"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted px-3 text-center text-sm text-muted-foreground">
                          <ImageIcon className="h-7 w-7" aria-hidden="true" />
                          缩略图生成失败
                        </div>
                      )}
                    </a>
                    <div className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="h-8 shrink-0 px-2.5 text-xs font-normal text-muted-foreground">
                          Size: {formatFileSize(photo.file_size)}
                        </Badge>
                        {isCover ? (
                          <Badge variant="secondary" className="shrink-0 gap-1">
                            <Star className="h-3.5 w-3.5" aria-hidden="true" />
                            封面
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetCover(photo)}
                          disabled={isCover || coveringPhotoId !== null}
                        >
                          {coveringPhotoId === photo.id ? "设置中..." : "设为封面"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPhotoToDelete(photo)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ShootingEntryFormDialog
        open={formOpen}
        entry={entry}
        items={items}
        onOpenChange={setFormOpen}
        onSaved={loadEntry}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除照片记录</DialogTitle>
            <DialogDescription>
              将删除 {entry.title} 及其图片记录和实际图片文件。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{deleteError}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={photoToDelete !== null} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除图片</DialogTitle>
            <DialogDescription>
              将删除图片 {photoToDelete?.file_name || ""}。此操作会删除图片记录和实际文件。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPhotoToDelete(null)} disabled={deletingPhoto}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeletePhoto} disabled={deletingPhoto}>
              {deletingPhoto ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
