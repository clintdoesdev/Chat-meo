import { MeoMark } from "@/components/meo-mark";

/** Full-screen loading state: a solid, heartbeat-pulsing Meo with blinking eyes. */
export function LoadingMeo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden="true"
          className="meo-heartbeat-glow absolute h-[150px] w-[150px] rounded-full bg-orange/40 blur-[32px]"
        />
        <div className="meo-heartbeat">
          <MeoMark size={72} excited />
        </div>
      </div>
    </div>
  );
}
