"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function HoopFeedCommentsDialog({ children, onClose }: {
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} className="hc-hoopfeed-comments" aria-label="Comments"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      event.stopPropagation();
      if (event.target === event.currentTarget) onClose();
    }}
    onDoubleClick={event => event.stopPropagation()}>
    <section>
      <header><h2>Comments</h2><button type="button" autoFocus onClick={onClose}>Close</button></header>
      {children}
    </section>
  </dialog>;
}
