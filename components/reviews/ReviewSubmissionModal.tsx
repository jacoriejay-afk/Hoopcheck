"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

export type ReviewCategory =
  | "Team"
  | "Women's Team"
  | "Coach"
  | "League"
  | "Agent";

export interface ReviewSubmission {
  entityName: string;
  rating: number;
  category: ReviewCategory;
  comment: string;
}

interface ReviewSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: ReviewSubmission) => void | Promise<void>;
}

const categories: ReviewCategory[] = [
  "Team",
  "Women's Team",
  "Coach",
  "League",
  "Agent",
];

export default function ReviewSubmissionModal({
  isOpen,
  onClose,
  onSubmit,
}: ReviewSubmissionModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(false);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  const [entityName, setEntityName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<ReviewCategory>("Team");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) onCloseRef.current();

      if (event.key === "Tab") {
        const dialog = document.getElementById(titleId)?.closest('[role="dialog"]');
        const focusable = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, titleId]);

  if (!mounted || !isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanName = entityName.trim();
    const cleanComment = comment.trim();

    if (!cleanName) {
      setError("Enter the name of the team, coach, league, or agent.");
      nameRef.current?.focus();
      return;
    }
    if (rating < 1 || rating > 5) {
      setError("Choose a rating from one to five stars.");
      return;
    }
    if (cleanComment.length < 20) {
      setError("Add at least 20 characters describing your experience.");
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    try {
      await onSubmit({
        entityName: cleanName,
        rating,
        category,
        comment: cleanComment,
      });
      setEntityName("");
      setRating(0);
      setHoverRating(0);
      setCategory("Team");
      setComment("");
      onClose();
    } catch {
      setError("Evaluation could not be submitted. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="hc-review-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="hc-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="hc-review-modal-header">
          <div>
            <p className="hc-review-eyebrow">HOOPCHECK / PLAYER INTELLIGENCE</p>
            <h2 id={titleId}>Submit Evaluation</h2>
            <p id={descriptionId} className="hc-review-description">
              Share a factual account of your professional experience.
            </p>
          </div>
          <button
            type="button"
            className="hc-review-close"
            aria-label="Close evaluation form"
            disabled={submitting}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form className="hc-review-form" onSubmit={handleSubmit}>
          <div className="hc-review-field">
            <label htmlFor="hc-review-entity">Entity name</label>
            <input
              ref={nameRef}
              id="hc-review-entity"
              name="entityName"
              value={entityName}
              onChange={(event) => setEntityName(event.target.value)}
              placeholder="ENTER TEAM, COACH, LEAGUE, OR AGENT"
              maxLength={120}
              autoComplete="off"
              required
            />
          </div>

          <fieldset className="hc-review-field hc-rating-field">
            <legend>Overall rating</legend>
            <div
              className="hc-review-stars"
              onMouseLeave={() => setHoverRating(0)}
            >
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const active = value <= (hoverRating || rating);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} out of 5 stars`}
                    aria-pressed={rating === value}
                    className="hc-review-star"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onFocus={() => setHoverRating(value)}
                    onBlur={() => setHoverRating(0)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={active ? "is-active" : ""}
                    >
                      <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" />
                    </svg>
                  </button>
                );
              })}
              <span className="hc-review-rating-value">
                {rating ? `${rating} / 5` : "SELECT RATING"}
              </span>
            </div>
          </fieldset>

          <div className="hc-review-field">
            <label htmlFor="hc-review-category">Category</label>
            <select
              id="hc-review-category"
              name="category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ReviewCategory)
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="hc-review-field">
            <label htmlFor="hc-review-comment">Your experience</label>
            <textarea
              id="hc-review-comment"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Describe communication, payment reliability, facilities, professionalism, or other relevant details..."
              minLength={20}
              maxLength={3000}
              rows={5}
              required
            />
            <div className="hc-review-field-meta">
              <span>Keep it factual and respectful.</span>
              <span>{comment.length}/3000</span>
            </div>
          </div>

          {error && (
            <p className="hc-review-error" role="alert">
              {error}
            </p>
          )}

          <footer className="hc-review-actions">
            <button
              type="button"
              className="hc-review-cancel"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="hc-review-submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Evaluation"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
