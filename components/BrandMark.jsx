// components/BrandMark.jsx
// One source of truth for the Sitecraft "S" mark. Previously there were
// three near-identical CSS rules (.logo-icon, .landing-logo-icon,
// .chat-msg-avatar, .chat-empty-icon) duplicating the same square-with-letter.

export default function BrandMark({ size = 28, className = '', style }) {
  // Drive sizing through a CSS variable so callers can override responsively
  // from a stylesheet (e.g. the mobile rule shrinking the studio logo).
  return (
    <div
      className={`brand-mark ${className}`}
      style={{ '--bm-size': `${size}px`, ...style }}
      aria-hidden="true"
    >
      S
    </div>
  );
}
