import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none motion-reduce:transition-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,#0284c7,#16a34a)] text-[var(--primary-foreground)] shadow-[0_10px_24px_rgba(2,132,199,0.22)] ring-1 ring-transparent hover:-translate-y-0.5 hover:brightness-105 hover:ring-[#9fe9d1] hover:shadow-[0_16px_34px_rgba(22,163,74,0.30)] active:translate-y-0 active:scale-[0.99]",
        secondary:
          "border border-[var(--border-soft)] bg-[var(--surface-panel)] text-[var(--ink-primary)] hover:-translate-y-0.5 hover:border-[#9fcbd1] hover:bg-[#f3fbfb] hover:shadow-[0_10px_22px_rgba(15,61,74,0.10)] active:translate-y-0 active:scale-[0.99]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const buttonProps = asChild ? props : { ...props, type: type ?? "button" };

    return <Comp className={cn(buttonVariants({ variant, className }))} ref={ref} {...buttonProps} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
