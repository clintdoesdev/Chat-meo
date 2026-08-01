"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteAiNodeDocument,
  listAiNodeDocuments,
  uploadAiNodeDocument,
  type AiNodeDocumentSummary,
} from "@/lib/actions/ai-documents";

function formatSize(charCount: number): string {
  if (charCount < 1000) return `${charCount} chars`;
  return `${(charCount / 1000).toFixed(1)}k chars`;
}

/**
 * Lets a flow author attach reference documents (txt/md/pdf) to an AI node — their extracted
 * text gets appended to the node's system prompt at conversation time (see
 * src/lib/chat/attach-ai-documents.ts), so the model can answer from them without the author
 * having to paste everything into the prompt by hand.
 */
export function KnowledgeUpload({ flowId, nodeId }: { flowId: string; nodeId: string }) {
  const [docs, setDocs] = useState<AiNodeDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocs(null);
    setError(null);
    listAiNodeDocuments(flowId, nodeId).then(setDocs);
  }, [flowId, nodeId]);

  function handleFileChosen(file: File) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("flowId", flowId);
      formData.set("nodeId", nodeId);
      formData.set("file", file);
      const result = await uploadAiNodeDocument(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.document) {
        setDocs((prev) => [...(prev ?? []), result.document!]);
      }
    });
  }

  function handleDelete(docId: string) {
    startTransition(async () => {
      const result = await deleteAiNodeDocument(docId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDocs((prev) => (prev ?? []).filter((doc) => doc.id !== docId));
    });
  }

  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-xs font-semibold text-muted">Knowledge</label>
      <p className="mb-2 text-[11px] leading-relaxed text-muted">
        Upload docs (.txt, .md, .pdf) for this AI to reference when it replies.
      </p>

      <div className="mb-2 flex flex-col gap-1.5">
        {docs === null && <p className="text-[11.5px] text-muted">Loading…</p>}
        {docs?.length === 0 && (
          <p className="text-[11.5px] text-muted">No documents attached yet.</p>
        )}
        {docs?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 rounded-lg border border-line-2 bg-card-2 px-2.5 py-2"
          >
            <FileText size={14} className="flex-shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium text-text">{doc.fileName}</div>
              <div className="text-[10.5px] text-muted">{formatSize(doc.charCount)}</div>
            </div>
            <button
              type="button"
              data-fx-skip
              onClick={() => handleDelete(doc.id)}
              disabled={pending}
              aria-label={`Remove ${doc.fileName}`}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-bad disabled:opacity-40"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mb-2 text-[11px] text-bad">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFileChosen(file);
        }}
      />
      <button
        type="button"
        data-fx-skip
        onClick={() => fileInputRef.current?.click()}
        disabled={pending}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 py-2 text-[12px] font-semibold text-muted transition hover:border-orange-2/50 hover:text-text disabled:opacity-50"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </div>
  );
}
