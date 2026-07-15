export function BizuMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#00A868" height="32" rx="8" width="32" />
      <path
        d="M11 8.5h6.2c2.9 0 4.6 1.4 4.6 3.7 0 1.5-.8 2.6-2.1 3.2 1.7.5 2.7 1.8 2.7 3.6 0 2.6-1.9 4.2-5.1 4.2H11V8.5Zm3.2 5.9h2.6c1.1 0 1.8-.6 1.8-1.5s-.7-1.4-1.8-1.4h-2.6v2.9Zm0 6.2h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6h-3v3.2Z"
        fill="white"
      />
    </svg>
  );
}
