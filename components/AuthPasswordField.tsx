"use client";

import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "id" | "type"> & { id: string };

export default function AuthPasswordField({ id, ...input }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="hc-auth-password">
      <input {...input} id={id} type={visible ? "text" : "password"} />
      <button type="button" aria-controls={id}
        aria-label={(visible ? "Hide" : "Show") + (id === "confirm-password" ? " confirmation password" : " password")}
        onClick={() => setVisible(!visible)}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
