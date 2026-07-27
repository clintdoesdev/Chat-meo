type SplitTagProps = {
  segment: string;
  label: string;
};

export function SplitTag({ segment, label }: SplitTagProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-white/3 p-1 pr-3.5 text-[12.5px] text-[#CFCFCF]">
      <span className="rounded-full bg-grad-orange px-2.5 py-1 text-[12px] font-semibold text-white">
        {segment}
      </span>
      {label}
    </span>
  );
}
