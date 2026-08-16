"use client";

import { useEffect, useRef, useState } from "react";
import { ActionsEditIcon, ActionsUploadIcon, AnimatedSpinnerIcon } from "@/components/icons";
import {
  getWhatsAppBusinessProfileInfo,
  requestWhatsAppNameChangeAction,
  updateWhatsAppProfilePictureAction,
  type WhatsAppBusinessProfileInfo,
} from "@/lib/actions/whatsapp";

const MAX_PICTURE_BYTES = 5_000_000;

// Meta's own name_status values, best-effort — see getWhatsAppBusinessProfile's doc comment in
// meta-graph.ts for why this stays a loose string rather than a locked-down union.
function statusBadge(nameStatus: string | null): { text: string; className: string } | null {
  if (!nameStatus) return null;
  const normalized = nameStatus.toUpperCase();
  if (normalized.includes("APPROV") || normalized.includes("AVAILABLE")) {
    return { text: "Approved", className: "border-ok/30 bg-ok/10 text-ok" };
  }
  if (normalized.includes("PENDING")) {
    return { text: "Pending review", className: "border-orange-2/30 bg-orange-2/10 text-orange-2" };
  }
  if (normalized.includes("REJECT") || normalized.includes("DECLIN")) {
    return { text: "Declined", className: "border-bad/30 bg-bad/10 text-bad" };
  }
  return { text: nameStatus, className: "border-line-2 bg-card-2 text-muted" };
}

/** Lets a seller view and change their WhatsApp Business display name and profile picture — only
 * ever rendered while WhatsAppConnectPanel shows a live (non-DISCONNECTED) connection. Always
 * reads current values fresh from Meta on mount (see getWhatsAppBusinessProfileInfo) rather than
 * from anything cached locally. */
export function WhatsAppBusinessProfilePanel({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WhatsAppBusinessProfileInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [namePending, setNamePending] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameRequested, setNameRequested] = useState(false);

  const [picturePending, setPicturePending] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const pictureFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getWhatsAppBusinessProfileInfo(botId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setProfile(result.profile);
      setNameInput(result.profile?.name ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  async function handleRequestNameChange() {
    setNameError(null);
    setNameRequested(false);
    setNamePending(true);
    const result = await requestWhatsAppNameChangeAction(botId, nameInput);
    setNamePending(false);
    if (result.error) {
      setNameError(result.error);
      return;
    }
    setNameRequested(true);
  }

  function handlePictureFile(file: File | undefined) {
    if (!file) return;
    setPictureError(null);
    if (!file.type.startsWith("image/")) {
      setPictureError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      setPictureError("That image is too large — try one under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setPicturePending(true);
      const result = await updateWhatsAppProfilePictureAction(botId, dataUri);
      setPicturePending(false);
      if (result.error) {
        setPictureError(result.error);
        return;
      }
      setProfile((prev) => (prev ? { ...prev, profilePictureUrl: dataUri } : prev));
    };
    reader.onerror = () => setPictureError("Couldn't read that file — try another image.");
    reader.readAsDataURL(file);
  }

  if (loading) {
    return <p className="mt-3.5 text-[11.5px] text-muted">Loading business profile…</p>;
  }

  if (loadError) {
    return <p className="mt-3.5 text-[11.5px] text-bad">{loadError}</p>;
  }

  const badge = statusBadge(profile?.nameStatus ?? null);

  return (
    <div className="mt-3.5 rounded-xl border border-line-2 bg-card-2 p-3.5">
      <p className="text-[12.5px] font-semibold text-text">Business profile</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        The name and photo customers see next to your number on WhatsApp.
      </p>

      <div className="mt-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-2 bg-[#111]">
          {profile?.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Meta-hosted or freshly-uploaded data: URI, not a local/optimizable asset
            <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-bold text-muted">?</span>
          )}
        </span>
        <input
          ref={pictureFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handlePictureFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => pictureFileRef.current?.click()}
          disabled={picturePending}
          className="flex items-center gap-1.5 rounded-full border border-line-2 bg-[#111] px-3 py-2 text-[12px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
        >
          {picturePending ? <AnimatedSpinnerIcon size={13} /> : <ActionsUploadIcon size={13} />}
          {picturePending ? "Uploading…" : "Upload new photo"}
        </button>
      </div>
      {pictureError && <p className="mt-1.5 text-[11px] text-bad">{pictureError}</p>}

      <div className="mt-3.5 border-t border-line-2 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="whatsapp-display-name" className="text-[11px] font-semibold text-muted">
            Display name
          </label>
          {badge && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${badge.className}`}>
              {badge.text}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="whatsapp-display-name"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value);
              setNameRequested(false);
            }}
            maxLength={60}
            className="flex-1 rounded-[13px] border border-line-2 bg-[#111] px-3.5 py-2.5 text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRequestNameChange}
            disabled={namePending || !nameInput.trim() || nameInput.trim() === profile?.name}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-[#111] px-3 py-2 text-[12px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
          >
            {namePending ? <AnimatedSpinnerIcon size={13} /> : <ActionsEditIcon size={13} />}
            {namePending ? "Submitting…" : "Request change"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          Meta reviews every display name change — usually within 24 hours, up to 10 changes per
          30 days. This keeps showing your current approved name until that finishes.
        </p>
        {nameRequested && (
          <p className="mt-1.5 text-[11px] text-ok">Submitted — check back here for the review result.</p>
        )}
        {nameError && <p className="mt-1.5 text-[11px] text-bad">{nameError}</p>}
      </div>
    </div>
  );
}
