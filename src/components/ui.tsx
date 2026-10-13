import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif leading-none ${className}`} aria-label="DevizIA">
      deviz<span className="italic text-accent">IA</span>
    </span>
  );
}

export function SparkIcon({ className = "h-4 w-4", label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CameraIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-ink px-6 text-base font-bold text-cream transition-transform active:scale-[0.99] ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-white px-5 text-sm font-bold text-ink ${className}`}
    >
      {children}
    </button>
  );
}

/** Choix unique sous forme de pastilles. */
export function Pills<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <button
            key={String(o.key)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.key)}
            className={`min-h-11 rounded-full border-[1.5px] px-4 text-sm ${
              selected ? "border-ink bg-ink font-bold text-cream" : "border-line bg-white font-semibold text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Silhouette de dos aux cheveux longs, utilisée dans le viseur et les visuels. */
export function Silhouette({ variant = "solid", className = "" }: { variant?: "solid" | "outline" | "dark"; className?: string }) {
  const hair = "M100 26 C62 26 44 54 46 92 C48 128 36 168 44 206 C50 236 44 262 54 284 C80 292 120 292 146 284 C156 262 150 236 156 206 C164 168 152 128 154 92 C156 54 138 26 100 26 Z";
  const shoulders = "M14 300 C16 254 52 236 100 232 C148 236 184 254 186 300 Z";
  if (variant === "outline") {
    return (
      <svg viewBox="0 0 200 300" className={className} aria-hidden>
        <path d={shoulders} fill="none" stroke="#f4ebe3" strokeOpacity={0.7} strokeWidth={2} strokeDasharray="6 6" />
        <path d={hair} fill="none" stroke="#f4ebe3" strokeOpacity={0.85} strokeWidth={2} strokeDasharray="6 6" />
      </svg>
    );
  }
  const dark = variant === "dark";
  return (
    <svg viewBox="0 0 200 300" className={className} aria-hidden>
      <path d={shoulders} fill={dark ? "#8c7262" : "#c9ae9c"} />
      <path d={hair} fill={dark ? "#120d0b" : "#3b2a22"} />
      <path d="M78 60 C70 120 82 180 70 270 M100 50 C96 120 106 190 98 286 M122 60 C130 120 118 180 130 270" stroke={dark ? "#4a3429" : "#5e4234"} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M86 170 C84 210 90 240 84 282 M114 170 C116 210 110 240 116 282 M64 190 C60 230 66 254 62 276" stroke="#b98a5e" strokeWidth={3} fill="none" strokeLinecap="round" />
    </svg>
  );
}
