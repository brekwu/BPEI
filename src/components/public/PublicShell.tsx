import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import type { ReactNode } from "react";
export function PublicShell({children}:{children:ReactNode}) {
return <div className="flex min-h-screen flex-col bg-background"><SiteHeader/><main className="flex-1">{children}</main><SiteFooter/></div>;
}
