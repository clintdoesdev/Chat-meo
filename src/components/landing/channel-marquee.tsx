const CHANNELS = ["Website widget", "WhatsApp", "Telegram", "Slack", "Webhooks", "Email"];

function ChannelRow() {
  return (
    <>
      {CHANNELS.map((label) => (
        <span key={label} className="flex items-center gap-2.5 whitespace-nowrap text-[16px] font-bold text-muted">
          <span className="inline-block h-2 w-2 rotate-45 rounded-[2px] bg-orange-2/60" />
          {label}
        </span>
      ))}
    </>
  );
}

export function ChannelMarquee() {
  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div className="marquee-track flex w-max items-center gap-14">
        <ChannelRow />
        <ChannelRow />
      </div>
    </div>
  );
}
