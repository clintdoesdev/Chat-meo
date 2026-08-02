"use client";

import { ActionsTrashIcon } from "@/components/icons";

export function ConfirmDeleteModal({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div onClick={onCancel} aria-hidden="true" className="fixed inset-0 z-[95] bg-black/60" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm delete"
        className="fixed left-1/2 top-1/2 z-[100] w-[min(320px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-2 bg-[#161616] p-5 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]"
      >
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-bad/10 text-bad">
          <ActionsTrashIcon size={20} />
        </span>
        <h3 className="mb-1.5 text-[14.5px] font-bold">Delete &ldquo;{label}&rdquo;?</h3>
        <p className="mb-4 text-[12.5px] text-muted">This can&apos;t be undone.</p>
        <div className="flex gap-2">
          <button
            type="button"
            data-fx-skip
            onClick={onCancel}
            className="flex-1 rounded-full border border-line-2 bg-card-2 py-[10px] text-[13px] font-semibold text-muted transition hover:border-orange-2/40"
          >
            Cancel
          </button>
          <button
            type="button"
            data-fx-skip
            onClick={onConfirm}
            className="flex-1 rounded-full bg-bad py-[10px] text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
