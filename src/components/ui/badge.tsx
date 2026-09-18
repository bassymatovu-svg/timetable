import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-white shadow-xs",
        secondary:
          "border-transparent bg-slate-100 text-slate-800",
        destructive:
          "border-transparent bg-red-100 text-red-800 border-red-200",
        outline: "text-slate-700 border-slate-300",
        primary: "border-transparent bg-blue-50 text-[#1D4ED8] border-blue-200",
        success: "border-transparent bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "border-transparent bg-amber-50 text-amber-800 border-amber-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
