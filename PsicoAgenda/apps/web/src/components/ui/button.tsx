import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.975] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-2xs hover:shadow-xs active:bg-[#0062C4]",
        outline:
          "border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.06] hover:bg-black/[0.04] dark:hover:bg-white/[0.1] text-foreground shadow-2xs",
        secondary:
          "bg-black/[0.05] dark:bg-white/[0.08] text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12]",
        ghost:
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-foreground",
        destructive:
          "bg-[#FF3B30] text-white hover:bg-[#E0342A] shadow-2xs",
        link: "text-[#0071E3] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5",
        xs: "h-6.5 gap-1 rounded-lg px-2 text-xs",
        sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[0.82rem]",
        lg: "h-11 gap-2 rounded-2xl px-5 text-[15px]",
        pill: "h-10 gap-2 rounded-full px-5",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-6 rounded-lg",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
