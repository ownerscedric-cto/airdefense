import { copyText } from "./clipboard";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed" | "noop";

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function canShareFiles(files: File[]): boolean {
  try {
    return (
      canNativeShare() &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files })
    );
  } catch {
    return false;
  }
}

export async function shareText(text: string): Promise<ShareResult> {
  if (canNativeShare()) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      console.warn("[share] shareText failed", err);
    }
  }
  const ok = await copyText(text);
  return ok ? "copied" : "failed";
}

export async function shareFiles(files: File[]): Promise<ShareResult> {
  if (files.length === 0) return "noop";
  if (!canShareFiles(files)) {
    console.warn("[share] shareFiles: navigator.canShare(files) === false");
    return "failed";
  }
  try {
    await navigator.share({ files });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    console.warn("[share] shareFiles failed", err);
    return "failed";
  }
}
