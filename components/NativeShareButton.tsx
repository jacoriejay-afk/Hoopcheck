"use client";

import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export type NativeShareButtonProps = {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Share a public HoopCheck URL with the native share sheet where available. */
export default function NativeShareButton({
  title,
  text,
  url,
  className,
  children = "Share",
}: NativeShareButtonProps) {
  const shareCurrentPage = async () => {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!shareUrl) return;

    const payload = { title, text: text ?? title, url: shareUrl, dialogTitle: "Share HoopCheck" };

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share(payload);
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (error) {
      // Cancellation is expected on native share sheets; do not surface as an app error.
      if (error instanceof Error && /cancel/i.test(error.message)) return;
    }
  };

  return (
    <button type="button" className={className} onClick={() => void shareCurrentPage()}>
      {children}
    </button>
  );
}
