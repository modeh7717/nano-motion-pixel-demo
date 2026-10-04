export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="28"
      viewBox="0 0 32 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 24 12 4h6L8 24H2Zm11 0L23 4h6L19 24h-6Zm11 0 5-10 3 6-2 4h-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
