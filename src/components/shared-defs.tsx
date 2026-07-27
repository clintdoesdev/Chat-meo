export function SharedDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="meo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7A2F" />
          <stop offset="1" stopColor="#FF5C16" />
        </linearGradient>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,110,40,.5)" />
          <stop offset="1" stopColor="rgba(255,110,40,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
