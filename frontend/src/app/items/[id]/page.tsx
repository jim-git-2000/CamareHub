"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_BASE_URL, ApiError, deleteItem, getItem, listItemPhotos, listItemTransactions } from "@/lib/api";
import type { ItemRead, PhotoRead, TransactionRead } from "@/types";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; item: ItemRead; photos: PhotoRead[]; transactions: TransactionRead[] }
  | { status: "error"; message: string };

type DetailRow = {
  label: string;
  value: string | number | boolean | null | undefined;
};

const transactionGroups = [
  { key: "purchase", title: "购买记录", types: ["purchase", "buy", "bought", "acquire", "acquisition"] },
  { key: "repair", title: "维修记录", types: ["repair", "maintenance", "service"] },
  { key: "sale", title: "出售记录", types: ["sale", "sell", "sold"] }
];

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    camera: "相机",
    lens: "镜头",
    film: "胶片",
    accessory: "配件"
  };

  return labels[type] ?? type;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    owned: "持有",
    sold: "已出售",
    wishlist: "愿望清单",
    archived: "已归档"
  };

  return labels[status] ?? status;
}

function formatValue(value: DetailRow["value"]): string {
  if (value === null || value === undefined || value === "") {
    return "未填写";
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  return String(value);
}

function formatCurrency(value: number | null | undefined, currency = "CNY"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未填写";
  }

  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "未填写";
  }

  return value.slice(0, 10);
}

function photoSrc(photo: PhotoRead): string {
  return photo.url.startsWith("http") ? photo.url : `${API_BASE_URL}${photo.url}`;
}

function baseRows(item: ItemRead): DetailRow[] {
  return [
    { label: "品牌", value: item.brand },
    { label: "型号", value: item.model },
    { label: "昵称", value: item.nickname },
    { label: "类型", value: typeLabel(item.type) },
    { label: "状态", value: statusLabel(item.status) },
    { label: "序列号", value: item.serial_number },
    { label: "购买日期", value: formatDate(item.purchase_date) },
    { label: "购买价格", value: formatCurrency(item.purchase_price, item.currency) },
    { label: "当前估值", value: formatCurrency(item.current_value, item.currency) },
    { label: "成色", value: item.condition },
    { label: "存放位置", value: item.location },
    { label: "创建时间", value: formatDate(item.created_at) },
    { label: "更新时间", value: formatDate(item.updated_at) }
  ];
}

function typeRows(item: ItemRead): DetailRow[] {
  if (item.type === "camera") {
    return [
      { label: "卡口", value: item.camera?.mount },
      { label: "画幅", value: item.camera?.format },
      { label: "相机类型", value: item.camera?.camera_type },
      { label: "胶片规格", value: item.camera?.film_format },
      { label: "传感器类型", value: item.camera?.sensor_type },
      { label: "像素", value: item.camera?.megapixels ? `${item.camera.megapixels} MP` : null },
      { label: "快门类型", value: item.camera?.shutter_type },
      { label: "测光", value: item.camera?.metering },
      { label: "电池", value: item.camera?.battery_type },
      { label: "重量", value: item.camera?.weight_g ? `${item.camera.weight_g} g` : null }
    ];
  }

  if (item.type === "lens") {
    return [
      { label: "卡口", value: item.lens?.mount },
      { label: "最短焦距", value: item.lens?.focal_length_min ? `${item.lens.focal_length_min} mm` : null },
      { label: "最长焦距", value: item.lens?.focal_length_max ? `${item.lens.focal_length_max} mm` : null },
      { label: "最大光圈", value: item.lens?.aperture_max ? `f/${item.lens.aperture_max}` : null },
      { label: "最小光圈", value: item.lens?.aperture_min ? `f/${item.lens.aperture_min}` : null },
      { label: "滤镜尺寸", value: item.lens?.filter_size_mm ? `${item.lens.filter_size_mm} mm` : null },
      { label: "最近对焦", value: item.lens?.minimum_focus_m ? `${item.lens.minimum_focus_m} m` : null },
      { label: "防抖", value: item.lens?.stabilization },
      { label: "自动对焦", value: item.lens?.autofocus },
      { label: "重量", value: item.lens?.weight_g ? `${item.lens.weight_g} g` : null }
    ];
  }

  if (item.type === "film") {
    return [
      { label: "ISO", value: item.film?.iso },
      { label: "胶片规格", value: item.film?.film_format },
      { label: "色彩类型", value: item.film?.color_type },
      { label: "冲洗工艺", value: item.film?.process },
      { label: "有效期", value: formatDate(item.film?.expiry_date) },
      { label: "数量", value: item.film?.quantity },
      { label: "存储位置", value: item.film?.storage_location }
    ];
  }

  return [];
}

function customFieldRows(customFields: string | null | undefined): DetailRow[] {
  if (!customFields) {
    return [];
  }

  try {
    const parsed = JSON.parse(customFields) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([label, value]) => ({
        label,
        value: typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : JSON.stringify(value)
      }));
    }
  } catch {
    return [{ label: "自定义字段", value: customFields }];
  }

  return [{ label: "自定义字段", value: customFields }];
}

function DetailGrid({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border px-3 py-2">
          <div className="text-xs text-muted-foreground">{row.label}</div>
          <div className="mt-1 break-words text-sm">{formatValue(row.value)}</div>
        </div>
      ))}
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: TransactionRead[] }) {
  if (transactions.length === 0) {
    return <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">暂无记录</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日期</TableHead>
          <TableHead>金额</TableHead>
          <TableHead>对象</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{formatDate(transaction.date)}</TableCell>
            <TableCell>{formatCurrency(transaction.amount, transaction.currency)}</TableCell>
            <TableCell>{formatValue(transaction.vendor)}</TableCell>
            <TableCell className="max-w-64 break-words">{formatValue(transaction.notes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setState({ status: "error", message: "无效的器材 ID" });
      return;
    }

    setState({ status: "loading" });

    Promise.all([getItem(itemId), listItemPhotos(itemId), listItemTransactions(itemId)])
      .then(([item, photos, transactions]) => {
        if (active) {
          setState({ status: "ready", item, photos, transactions });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "error", message: "器材不存在或已被删除。" });
          return;
        }

        setState({ status: "error", message: error instanceof Error ? error.message : "器材详情加载失败" });
      });

    return () => {
      active = false;
    };
  }, [itemId]);

  const groupedTransactions = useMemo(() => {
    if (state.status !== "ready") {
      return new Map<string, TransactionRead[]>();
    }

    return new Map(
      transactionGroups.map((group) => [
        group.key,
        state.transactions.filter((transaction) => group.types.includes(transaction.type.toLowerCase()))
      ])
    );
  }, [state]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteItem(itemId);
      setDeleteOpen(false);
      router.push("/items");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载器材详情...
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline">
          <Link href="/items">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            返回列表
          </Link>
        </Button>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">无法查看器材详情</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { item, photos } = state;
  const customRows = customFieldRows(item.custom_fields);
  const specificRows = typeRows(item);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-4 mb-2">
            <Link href="/items">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              返回列表
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold tracking-normal">
              {item.brand} {item.model}
            </h1>
            <Badge variant="secondary">{typeLabel(item.type)}</Badge>
            <Badge variant="outline">{statusLabel(item.status)}</Badge>
          </div>
          {item.nickname ? <p className="mt-1 text-sm text-muted-foreground">{item.nickname}</p> : null}
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/items/${item.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
              编辑
            </Link>
          </Button>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid rows={baseRows(item)} />
          {item.notes ? (
            <div className="mt-4 rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">备注</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {specificRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">类型专属参数</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid rows={specificRows} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">图片列表</CardTitle>
          <CardDescription>已上传图片</CardDescription>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
              <ImageIcon className="mb-2 h-7 w-7" aria-hidden="true" />
              暂无图片
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photoSrc(photo)}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-md border"
                >
                  <img src={photoSrc(photo)} alt={photo.file_name} className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-90" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {transactionGroups.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={groupedTransactions.get(group.key) ?? []} />
            </CardContent>
          </Card>
        ))}
      </div>

      {customRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">自定义字段</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid rows={customRows} />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除器材</DialogTitle>
            <DialogDescription>
              将删除 {item.brand} {item.model} 及其关联图片记录和交易记录。此操作不可撤销。
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
    </div>
  );
}
