"use client";

import { FormEvent, useState } from "react";
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
import { createItemTransaction, updateItemTransaction } from "@/lib/api";
import type { TransactionMutationPayload, TransactionRead } from "@/types";

type TransactionFormValues = {
  type: string;
  amount: string;
  currency: string;
  date: string;
  vendor: string;
  notes: string;
};

const transactionTypes = [
  { value: "purchase", label: "购买" },
  { value: "repair", label: "维修" },
  { value: "sale", label: "出售" },
  { value: "maintenance", label: "保养" },
  { value: "accessory", label: "配件" }
];

function initialValues(transaction: TransactionRead | null, itemCurrency: string): TransactionFormValues {
  return {
    type: transaction?.type ?? "purchase",
    amount: transaction?.amount === null || transaction?.amount === undefined ? "" : String(transaction.amount),
    currency: transaction?.currency || itemCurrency || "CNY",
    date: transaction?.date ?? "",
    vendor: transaction?.vendor ?? "",
    notes: transaction?.notes ?? ""
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function TransactionFormDialog({
  itemId,
  itemCurrency,
  transaction,
  onOpenChange,
  onSaved
}: {
  itemId: number;
  itemCurrency: string;
  transaction: TransactionRead | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<TransactionFormValues>(() => initialValues(transaction, itemCurrency));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setValue = (key: keyof TransactionFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const trimmedAmount = values.amount.trim();
    const amount = trimmedAmount === "" ? null : Number(trimmedAmount);

    if (!transactionTypes.some((option) => option.value === values.type)) {
      nextErrors.type = "请选择交易类型";
    }
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      nextErrors.amount = "金额必须是大于或等于 0 的数字";
    }
    if (!values.currency.trim()) {
      nextErrors.currency = "请输入币种";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: TransactionMutationPayload = {
      type: values.type,
      amount,
      currency: values.currency.trim().toUpperCase(),
      date: values.date || null,
      vendor: optionalText(values.vendor),
      notes: optionalText(values.notes)
    };

    setSaving(true);
    setSubmitError(null);
    try {
      if (transaction) {
        await updateItemTransaction(transaction.id, payload);
      } else {
        await createItemTransaction(itemId, payload);
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "交易记录保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{transaction ? "编辑交易记录" : "新增交易记录"}</DialogTitle>
          <DialogDescription>交易记录只作为账本，不会自动修改器材状态、价格或估值。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {submitError ? (
            <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{submitError}</div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">类型</span>
              <Select value={values.type} onValueChange={(value) => setValue("type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transactionTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type ? <span className="block text-xs text-destructive">{errors.type}</span> : null}
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">日期</span>
              <Input type="date" value={values.date} onChange={(event) => setValue("date", event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">金额</span>
              <Input inputMode="decimal" value={values.amount} onChange={(event) => setValue("amount", event.target.value)} placeholder="可留空" />
              {errors.amount ? <span className="block text-xs text-destructive">{errors.amount}</span> : null}
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">币种</span>
              <Input value={values.currency} onChange={(event) => setValue("currency", event.target.value)} maxLength={8} />
              {errors.currency ? <span className="block text-xs text-destructive">{errors.currency}</span> : null}
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">商家 / 对方</span>
              <Input value={values.vendor} onChange={(event) => setValue("vendor", event.target.value)} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">备注</span>
              <Textarea value={values.notes} onChange={(event) => setValue("notes", event.target.value)} rows={3} />
            </label>
          </div>

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
