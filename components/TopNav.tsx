"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function TopNav() {
  const t = useTranslations("nav");
  const [user, setUser] = useState<{ email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#313131] border-b border-[#000000] px-6 py-5">
      <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
        <Link
          href="/"
          className="font-semibold text-white text-lg tracking-tight hover:opacity-90 transition-opacity"
        >
          FootballCave
        </Link>

        {/*        <div className="flex items-center gap-4 text-sm">
          <LocaleSwitcher />
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {t("signOut")}
            </button>
          ) : (
            <Link
              href="/auth"
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center"
            >
              <img
                src="/images/login.svg"
                alt="Login"
                className="w-5 h-5 object-contain"
              />
            </Link>
          )}
        </div> */}
      </div>
    </header>
  );
}
