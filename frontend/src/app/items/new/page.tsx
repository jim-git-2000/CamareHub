"use client";

import { useRouter } from "next/navigation";
import { ItemForm } from "@/components/item-form";
import { createItem } from "@/lib/api";
import type { ItemMutationPayload } from "@/types";

export default function NewItemPage() {
  const router = useRouter();

  const handleSubmit = async (payload: ItemMutationPayload) => {
    const item = await createItem(payload);
    router.push(`/items/${item.id}`);
  };

  return <ItemForm mode="create" onSubmit={handleSubmit} />;
}
