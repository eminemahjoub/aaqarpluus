"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";

export function NavbarGate() {
  const pathname = usePathname();
  const hide =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/agency") ||
    pathname.startsWith("/admin");
  if (hide) return null;
  return <Navbar />;
}

