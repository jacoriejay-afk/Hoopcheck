"use client";

type ProfileAvatarProps = {
  name?: string | null;
  src?: string | null;
  className?: string;
  size?: number;
};

export default function ProfileAvatar({ name, src, className = "", size = 44 }: ProfileAvatarProps) {
  const initial = (name || "Player").trim().charAt(0).toUpperCase() || "P";
  return (
    <span
      className={("hc-profile-avatar " + className).trim()}
      role="img"
      aria-label={name ? name + " profile avatar" : "Profile avatar"}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {src ? <img src={src} alt="" /> : <span className="hc-profile-avatar__initial">{initial}</span>}
    </span>
  );
}
