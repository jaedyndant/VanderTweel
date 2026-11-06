/** The double arch from the sign-in identity, shared by every brand placement. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="27"
      height="33"
      viewBox="0 0 27 33"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 33V13.5a12.5 12.5 0 0 1 25 0V33" strokeWidth="2" />
      <path d="M8.5 33V13.5a5 5 0 0 1 10 0V33" strokeWidth="1" />
    </svg>
  );
}
