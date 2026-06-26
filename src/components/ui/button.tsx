import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants = {
  default: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
  outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm",
  ghost: "hover:bg-slate-100 text-slate-700",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
};

const sizes = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-9 px-4 text-sm rounded-lg",
  lg: "h-10 px-5 text-sm rounded-lg font-medium",
  icon: "h-8 w-8 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
