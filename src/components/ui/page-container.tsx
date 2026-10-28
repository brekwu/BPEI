import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "narrow";
}

const SIZE = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

/**
 * Standard page shell for authenticated app routes.
 * Enforces consistent horizontal padding, max width and vertical rhythm.
 */
export function PageContainer({ children, className, size = "default" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8", SIZE[size], className)}>
      <div className="animate-fade-in space-y-6">{children}</div>
    </div>
  );
}