import { Globe, Hash, Mail, MessageCircle, Send, Webhook } from "lucide-react";

const CHANNELS = [
  { label: "Website widget", Icon: Globe },
  { label: "WhatsApp", Icon: MessageCircle },
  { label: "Telegram", Icon: Send },
  { label: "Slack", Icon: Hash },
  { label: "Webhooks", Icon: Webhook },
  { label: "Email", Icon: Mail },
];

function ChannelRow() {
  return (
    <>
      {CHANNELS.map(({ label, Icon }) => (
        <span
          key={label}
          className="flex items-center gap-2.5 text-[16px] font-bold tracking-[.02em] text-[#5E5E5E]"
        >
          <Icon size={18} className="opacity-85" />
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
