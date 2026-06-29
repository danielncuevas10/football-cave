"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";

type Team = {
  team_id: number;
  team_name: string;
  team_logo: string;
  rank: number;
  league_id: number;
};

const LOCALE_TAG: Record<string, string> = {
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
  bs: "bs-BA",
  sr: "sr-Latn",
  ch: "zh-CN",
  gr: "el-GR",
  jp: "ja-JP",
  kr: "ko-KR",
  tr: "tr-TR",
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [results, setResults] = useState<Team[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    fetch("/api/search/teams")
      .then((r) => r.json())
      .then((data: Team[]) => setAllTeams(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setActiveIdx(-1);
      return;
    }
    const q = norm(query);
    const filtered = allTeams
      .filter((t) => {
        const apiNorm = norm(t.team_name);
        const localizedNorm = norm(getLocalizedTeamName(t.team_name, locale));
        return apiNorm.includes(q) || localizedNorm.includes(q);
      })
      .slice(0, 8);
    setResults(filtered);
    setActiveIdx(-1);
  }, [query, allTeams, locale]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
  }, []);

  const navigate = useCallback(
    (team: Team) => {
      close();
      router.push(`/team/${team.team_id}`);
    },
    [close, router]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActiveIdx((i) => Math.max(i - 1, -1));
      e.preventDefault();
    } else if (e.key === "Enter" && activeIdx >= 0) {
      navigate(results[activeIdx]);
    }
  };

  const SkeletonDropdown = () => (
    <div className="absolute right-0 top-full mt-2 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-60 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse shrink-0" />
          <div className="flex-1 h-3 rounded bg-white/10 animate-pulse" />
          <div className="w-5 h-3 rounded bg-white/10 animate-pulse" />
        </div>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Search World Cup teams"
          className="flex items-center justify-center w-8 h-8 hover:opacity-70 transition-opacity"
        >
          <img
            src="/images/specs/look.svg"
            alt=""
            className="w-5 h-5 object-contain"
          />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search…"
            className="bg-[#1a1a1a] border border-white/20 text-white text-sm rounded-xl px-3 py-1.5 w-44 outline-none focus:border-white/50 placeholder:text-gray-500 transition-all"
          />
          <button
            onClick={close}
            className="text-gray-200 hover:text-white text-xs transition-colors shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {open && loading && query.length >= 1 && <SkeletonDropdown />}

      {!loading && results.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-60 overflow-hidden">
          {results.map((team, i) => (
            <button
              key={team.team_id}
              onClick={() => navigate(team)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === activeIdx ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <img
                src={team.team_logo}
                alt=""
                className="w-6 h-6 object-contain shrink-0"
                loading="lazy"
              />
              <span className="text-sm text-gray-100 flex-1 min-w-0 truncate">
                {getLocalizedTeamName(team.team_name, locale)}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.length >= 1 && results.length === 0 && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-60 px-4 py-3 text-xs text-gray-200">
          No teams found
        </div>
      )}
    </div>
  );
}
