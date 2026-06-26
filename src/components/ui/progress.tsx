import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  trackClassName?: string;
}

export function Progress({ value, className, trackClassName }: ProgressProps) {
  return (
    <div className={cn("h-1.5 w-full bg-slate-100 rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full bg-indigo-500 rounded-full transition-all duration-500", trackClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
