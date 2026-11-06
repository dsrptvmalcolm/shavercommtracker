"use client";

import { useState } from "react";

const DOWNLOAD_GAP_MS = 300;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tick the photos to save (all ticked to start), then two taps on purpose. Phones only open the share sheet
 * right after a tap, and fetching photos takes too long for the first tap to still count. Tap 1 fetches the
 * ticked photos (kept in memory); tap 2 opens the share sheet immediately so they can "Save Images" to the
 * camera roll. Desktops (no file sharing) download them instead.
 */
export function PhotoPicker({ urls, baseName }: { urls: string[]; baseName: string }) {
  const [picked, setPicked] = useState<boolean[]>(() => urls.map(() => true));
  const [files, setFiles] = useState<File[]>();
  const [status, setStatus] = useState<string>();
  const [working, setWorking] = useState(false);
  const count = picked.filter(Boolean).length;
  const canShareFiles = (list: File[]) => typeof navigator !== "undefined" && navigator.canShare?.({ files: list }) === true;

  // Changing the selection discards photos already fetched for the old selection
  const choose = (next: boolean[]) => {
    setPicked(next);
    setFiles(undefined);
    setStatus(undefined);
  };

  const fetchPhotos = async () => {
    const chosen = urls.map((url, i) => ({ url, n: i + 1 })).filter((_, i) => picked[i]);
    setWorking(true);
    setStatus(undefined);
    try {
      const fetched: File[] = [];
      for (const [i, { url, n }] of chosen.entries()) {
        setStatus(`Getting photos ${i + 1}/${chosen.length}…`);
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error(`Couldn't get photo ${n}, try again`);
        const blob = await res.blob();
        fetched.push(new File([blob], `${baseName}-${String(n).padStart(2, "0")}.jpg`, { type: blob.type || "image/jpeg" }));
      }
      setFiles(fetched);
      setStatus(canShareFiles(fetched) ? "Ready — tap Save to add them to your photos." : undefined);
    } catch (err) {
      setStatus(err instanceof Error && err.message.startsWith("Couldn't") ? err.message : "Couldn't get the photos, try again");
    } finally {
      setWorking(false);
    }
  };

  const savePhotos = async (list: File[]) => {
    if (canShareFiles(list)) {
      try {
        await navigator.share({ files: list, title: baseName });
        setStatus(undefined);
      } catch (err) {
        const name = (err as Error).name;
        // Closing the share sheet isn't an error; NotAllowedError means the tap expired — the photos are kept
        setStatus(name === "AbortError" ? undefined : name === "NotAllowedError" ? "Tap Save again to open sharing." : "Couldn't open sharing — try again");
      }
      return;
    }
    setWorking(true);
    for (const file of list) {
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      await pause(DOWNLOAD_GAP_MS);
    }
    setWorking(false);
    setStatus(`Downloaded ${list.length} photos`);
  };

  if (urls.length === 0) return <p className="text-sm text-on-surface-muted">No photos in the feed for this car yet.</p>;

  const plural = (n: number) => `${n} photo${n === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-on-surface-muted">
          {count} of {urls.length} selected
        </p>
        <div className="flex gap-1">
          <button type="button" onClick={() => choose(urls.map(() => true))} disabled={working} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-primary disabled:opacity-50">
            Select all
          </button>
          <button type="button" onClick={() => choose(urls.map(() => false))} disabled={working} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-on-surface-muted disabled:opacity-50">
            Clear
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((src, i) => (
          <li key={src}>
            <label className={`relative block cursor-pointer overflow-hidden rounded-lg border-2 ${picked[i] ? "border-primary" : "border-transparent opacity-50"}`}>
              <input
                type="checkbox"
                checked={picked[i]}
                disabled={working}
                onChange={(e) => choose(picked.map((p, j) => (j === i ? e.target.checked : p)))}
                aria-label={`Photo ${i + 1}`}
                className="absolute left-1.5 top-1.5 h-5 w-5 accent-primary"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </label>
          </li>
        ))}
      </ul>

      {files ? (
        <button type="button" onClick={() => savePhotos(files)} disabled={working} className="btn-primary w-full px-4 py-2 sm:w-auto">
          {canShareFiles(files) ? `Save ${plural(files.length)}` : `Download ${plural(files.length)}`}
        </button>
      ) : (
        <button type="button" onClick={fetchPhotos} disabled={working || count === 0} className="btn-primary w-full px-4 py-2 sm:w-auto">
          {working ? "Getting photos…" : count === 0 ? "Pick at least one photo" : `Get ${plural(count)}`}
        </button>
      )}
      {status && (
        <p aria-live="polite" className="text-xs text-on-surface-muted">
          {status}
        </p>
      )}
    </div>
  );
}
