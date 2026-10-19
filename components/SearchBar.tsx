"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";

type SearchBarProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  name?: string;
  action?: string;
  className?: string;
  inputId?: string;
  ariaLabel?: string;
  disabled?: boolean;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "autoComplete" | "required">;

export default function SearchBar({
  value,
  defaultValue = "",
  onChange,
  onSubmit,
  placeholder = "Search players, coaches, teams, or leagues",
  buttonLabel = "Search",
  name = "q",
  action = "/search",
  className = "",
  inputId,
  ariaLabel = "Search players, coaches, teams, or leagues",
  disabled = false,
  autoComplete = "off",
  required = false,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!onSubmit) return;
    event.preventDefault();
    onSubmit(currentValue.trim());
  }

  function change(next: string) {
    if (!controlled) setInternalValue(next);
    onChange?.(next);
  }

  return (
    <form className={`hc-searchbar ${className}`.trim()} role="search" action={onSubmit ? undefined : action} method="get" onSubmit={handleSubmit}>
      <svg className="hc-searchbar__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.2 4.2" />
      </svg>
      <input
        id={inputId}
        className="hc-searchbar__input"
        type="search"
        name={name}
        value={currentValue}
        onChange={(event) => change(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
      />
      {currentValue && <button className="hc-searchbar__clear" type="button" aria-label="Clear search" onClick={() => change("")}>×</button>}
      <button className="hc-searchbar__submit" type="submit" disabled={disabled}>{buttonLabel}</button>
    </form>
  );
}
