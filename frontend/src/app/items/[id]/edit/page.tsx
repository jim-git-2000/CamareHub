"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemForm } from "@/components/item-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getItem, updateItem } from "@/lib/api";
import type { ItemMutationPayload, ItemRead } from "@/types";

type EditState =
  | { status: "loading" }
  | { status: "ready"; item: ItemRead }
  | { status: "error"; message: string };

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);
  const [state, setState] = useState<EditState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setState({ status: "error", message: "无效的器材 ID" });
      return;
    }

    getItem(itemId)
      .then((item) => {
        if (active) {
          setState({ status: "ready", item });
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

        setState({ status: "error", message: error instanceof Error ? error.message : "器材加载失败" });
      });

    return () => {
      active = false;
    };
  }, [itemId]);

  const handleSubmit = async (payload: ItemMutationPayload) => {
    const item = await updateItem(itemId, payload);
    router.push(`/items/${item.id}`);
  };

  if (state.status === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载编辑表单...
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
            <CardTitle className="text-base">无法编辑器材</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <ItemForm mode="edit" initialItem={state.item} onSubmit={handleSubmit} />;
}
