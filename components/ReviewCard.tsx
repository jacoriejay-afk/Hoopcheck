import Image from "next/image";
import type { ReactNode } from "react";

export interface ReviewCardProps {
  username: string;
  date: string;
  rating: number;
  text: string;
  avatarUrl?: string;
  avatarFallback?: string;
  className?: string;
  children?: ReactNode;
}

export default function ReviewCard({ username, date, rating, text, avatarUrl, avatarFallback, className = "", children }: ReviewCardProps) {
  const score = Math.min(5, Math.max(0, Number.isFinite(rating) ? rating : 0));
  const initials = avatarFallback ?? username.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <article className={`hc-review-card ${className}`.trim()}>
    <header className="hc-review-card__header">
      <span className="hc-review-card__avatar">
        {avatarUrl ? <Image src={avatarUrl} alt="" width={42} height={42} unoptimized /> : <span aria-hidden="true">{initials}</span>}
      </span>
      <span className="hc-review-card__identity"><strong>{username}</strong><time>{date}</time></span>
      <span className="hc-review-card__stars" aria-label={`${score} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= Math.round(score) ? "★" : "☆"}</span>)}</span>
    </header>
    <p className="hc-review-card__text">{text}</p>
    {children}
  </article>;
}
