import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "verified" | "overstated" | "fraudulent" | "neutral"
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-mono border",
        {
          "bg-emerald-50 border-emerald-400 text-emerald-800": variant === "verified",
          "bg-amber-50 border-amber-400 text-amber-800": variant === "overstated",
          "bg-red-50 border-red-400 text-red-800": variant === "fraudulent",
          "bg-zinc-50 border-zinc-300 text-zinc-700": variant === "neutral",
        },
        className
      )}
      {...props}
    />
  )
}
