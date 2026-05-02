import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function resolveLogoSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/objects/")) return `/api/storage${value}`;
  return value;
}

export function BrandMark({
  businessName,
  logoUrl,
  size = "md",
  className,
}: {
  businessName: string;
  logoUrl: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: { box: "w-8 h-8", icon: "w-4 h-4" },
    md: { box: "w-10 h-10", icon: "w-5 h-5" },
    lg: { box: "w-14 h-14", icon: "w-7 h-7" },
    xl: { box: "w-24 h-24", icon: "w-12 h-12" },
  } as const;
  const { box, icon } = sizes[size];
  const src = resolveLogoSrc(logoUrl);

  return (
    <div
      className={cn(
        box,
        "rounded-full border-2 border-primary/30 bg-primary/10 overflow-hidden flex items-center justify-center flex-shrink-0",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={businessName}
          className="w-full h-full object-cover"
        />
      ) : (
        <Store className={cn(icon, "text-primary")} />
      )}
    </div>
  );
}
