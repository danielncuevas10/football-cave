"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import SearchBar from "@/components/SearchBar";

type BarState = "hidden" | "loading" | "done";

export default function TopNav() {
  const t = useTranslations("nav");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const pathname = usePathname();
  const [barState, setBarState] = useState<BarState>("hidden");
  const prevPathname = useRef(pathname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor?.href) return;
      try {
        const url = new URL(anchor.href);
        if (
          url.origin === window.location.origin &&
          url.pathname !== pathname
        ) {
          setBarState("loading");
        }
      } catch {}
    };
    const handleNavStart = () => setBarState("loading");
    document.addEventListener("click", handleClick);
    window.addEventListener("nav-start", handleNavStart);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("nav-start", handleNavStart);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setBarState("done");
      const timer = setTimeout(() => setBarState("hidden"), 500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const width =
    barState === "hidden" ? "0%" : barState === "loading" ? "80%" : "100%";
  const transition =
    barState === "loading"
      ? "width 800ms ease-out"
      : barState === "done"
      ? "width 200ms ease-out, opacity 300ms ease-out 200ms"
      : "none";
  const opacity = barState === "done" ? 0 : barState === "loading" ? 1 : 0;

  return (
    <header className="sticky top-0 z-50 bg-[#303030] border-b border-[#000000] px-6 py-5">
      <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
        <Link
          href="/"
          className="font-semibold text-white text-lg tracking-tight hover:opacity-90 transition-opacity"
        >
          FootballCave
        </Link>

        <SearchBar />
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-white"
        style={{ width, opacity, transition }}
      />
    </header>
  );
}
