type MeoMarkProps = {
  size?: number;
  excited?: boolean;
  className?: string;
};

const BODY_PATH =
  "M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6z";

export function MeoMark({ size = 32, excited = false, className }: MeoMarkProps) {
  const eyeClass = `meo-eye${excited ? " is-excited" : ""}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Meo"
      className={className}
    >
      <path d={BODY_PATH} fill="url(#meo-gradient)" />
      <circle className={eyeClass} cx="24" cy="30" r="4.4" fill="#1A0B00" />
      <circle
        className={eyeClass}
        cx="40"
        cy="30"
        r="4.4"
        fill="#1A0B00"
        style={{ animationDelay: "0.08s" }}
      />
    </svg>
  );
}
