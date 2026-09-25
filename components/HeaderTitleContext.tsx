"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { uiCopy } from "@/site.config";

type HeaderTitleContextType = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const HeaderTitleContext = createContext<HeaderTitleContextType>({
  title: null,
  setTitle: () => {},
});

export function HeaderTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Reset custom title override during render when pathname changes
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setTitle(null);
  }

  return (
    <HeaderTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </HeaderTitleContext.Provider>
  );
}

export function useHeaderTitleContext() {
  return useContext(HeaderTitleContext);
}

/**
 * Component to imperatively set the title in the fixed top header from any page.
 */
export function HeaderTitle({ title }: { title: string }) {
  const { setTitle } = useHeaderTitleContext();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);

  return null;
}

export function resolveHeaderTitle(pathname: string, customTitle: string | null): string {
  if (customTitle) return customTitle;
  if (!pathname || pathname === "/") return "";
  if (pathname === "/agenda") return uiCopy.agendaPage.heading;
  if (pathname === "/my-agenda") return "My agenda";
  if (pathname === "/speakers") return uiCopy.speakersPage.heading;
  if (pathname.startsWith("/speakers/")) return "Speaker";
  if (pathname === "/games") return "Mini Games";
  if (pathname === "/memories") return uiCopy.memoriesPage.heading;
  if (pathname === "/partner") return "Community Partnership";
  if (pathname === "/profile") return "My profile";
  if (pathname === "/signin") return "Sign in";
  if (pathname === "/contact") return uiCopy.contactPage.heading;
  if (pathname === "/tickets") return uiCopy.ticketsList.heading;
  if (pathname === "/tickets/select") return "Get Tickets";
  return "";
}
