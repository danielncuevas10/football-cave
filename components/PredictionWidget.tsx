"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";

type Phase = "idle" | "loading" | "voted";
type Prediction = "home" | "draw" | "away";

interface Results {
  home: number;
  draw: number;
  away: number;
  total: number;
}

interface PredictResponse {
  home: number;
  draw: number;
  away: number;
  total: number;
  userVote: Prediction | null;
}

interface PredictionWidgetProps {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  isKnockout?: boolean;
}

export default function PredictionWidget({
  matchId,
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  isKnockout = false,
}: PredictionWidgetProps) {
  const t = useTranslations("prediction");
  const locale = useLocale();

  const localHomeTeam = getLocalizedTeamName(homeTeam, locale);
  const localAwayTeam = getLocalizedTeamName(awayTeam, locale);

  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<Results | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [displayPcts, setDisplayPcts] = useState({ home: 0, draw: 0, away: 0 });
  const [clickFeedback, setClickFeedback] = useState<{
    key: Prediction;
    fading: boolean;
  } | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/match/${matchId}/predict`)
      .then((r) => r.json())
      .then((data: PredictResponse) => {
        setResults({
          home: data.home,
          draw: data.draw,
          away: data.away,
          total: data.total,
        });
        if (data.userVote) {
          setPhase("voted");
        }
      })
      .catch(() => {});
  }, [matchId]);

  // Animate percentages when entering voted phase (only once)
  useEffect(() => {
    if (phase !== "voted" || !results || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    setDisplayPcts({ home: 0, draw: 0, away: 0 });

    const duration = 1200;
    const start = Date.now();

    // In knockout mode, draw votes in the DB (legacy or erroneous) dilute home/away.
    // Re-normalize to a 2-way denominator so the displayed values sum to 100%.
    let targetHome = results.home;
    let targetAway = results.away;
    if (isKnockout) {
      const twoWay = results.home + results.away;
      targetHome = twoWay > 0 ? Math.round((results.home / twoWay) * 100) : 50;
      targetAway = twoWay > 0 ? 100 - targetHome : 50;
    }
    const target = {
      home: targetHome,
      draw: results.draw,
      away: targetAway,
    };

    let rafId: number;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayPcts({
        home: Math.round(target.home * ease),
        draw: Math.round(target.draw * ease),
        away: Math.round(target.away * ease),
      });
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [phase, results, isKnockout]);

  const vote = async (prediction: Prediction) => {
    setPhase("loading");
    setError(null);

    // Trigger border+bg fade animation on clicked button
    setClickFeedback({ key: prediction, fading: false });
    setTimeout(() => {
      setClickFeedback((f) => (f ? { ...f, fading: true } : null));
    }, 16);

    try {
      const res = await fetch(`/api/match/${matchId}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, prediction }),
      });
      const data = (await res.json()) as PredictResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("error"));
        setPhase("idle");
        setClickFeedback(null);
        return;
      }
      setResults({
        home: data.home,
        draw: data.draw,
        away: data.away,
        total: data.total,
      });
      setPhase("voted");
    } catch {
      setError(t("error"));
      setPhase("idle");
      setClickFeedback(null);
    }
  };

  const isLoading = phase === "loading";
  const isVoted = phase === "voted";

  const getButtonClass = (key: Prediction) => {
    const base =
      "flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-[10px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-150";
    if (isLoading) {
      if (clickFeedback?.key === key) {
        return `${base} pointer-events-none`;
      }
      return `${base} bg-[#2C2C2E] border-white/8 opacity-50 pointer-events-none`;
    }
    if (isVoted) {
      return "flex-1 flex flex-col items-center gap-2 py-3 px-2 pointer-events-none";
    }
    return `${base} bg-[#2C2C2E] border-white/8 hover:bg-[#363636]`;
  };

  const getClickedButtonStyle = (key: Prediction): React.CSSProperties => {
    if (phase !== "loading" || clickFeedback?.key !== key) return {};
    return {
      borderColor: clickFeedback.fading
        ? "rgba(255,255,255,0)"
        : "rgba(255,255,255,1)",
      backgroundColor: clickFeedback.fading
        ? "rgba(44,44,46,0)"
        : "rgba(44,44,46,1)",
      transition: "border-color 2s ease-out, background-color 2s ease-out",
    };
  };

  const buttons: { key: Prediction; label: string; logo: string | null }[] = [
    { key: "home", label: localHomeTeam, logo: homeLogo },
    ...(!isKnockout
      ? [{ key: "draw" as Prediction, label: t("draw"), logo: null }]
      : []),
    { key: "away", label: localAwayTeam, logo: awayLogo },
  ];

  return (
    <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 mb-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-gray-300 text-center mb-3">
        {t("whoWillWin")}
      </p>

      <div className="flex gap-2">
        {buttons.map(({ key, label, logo }) => (
          <button
            key={key}
            onClick={() => !isVoted && !isLoading && vote(key)}
            className={getButtonClass(key)}
            style={getClickedButtonStyle(key)}
          >
            {logo ? (
              <div className="w-8 h-5 overflow-hidden shrink-0 border border-gray-300 rounded-tr-lg rounded-bl-lg">
                <img
                  src={logo}
                  alt=""
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ) : (
              <img
                src="/images/specs/draw.svg"
                alt=""
                className="w-5 h-5 object-contain opacity-40"
              />
            )}
            <span className="text-[11px] text-[#8E8E93] font-medium leading-tight text-center line-clamp-2">
              {label}
            </span>
            {isVoted && (
              <span className="text-[13px] font-semibold text-white">
                {isKnockout && results
                  ? (() => {
                      const twoWay = results.home + results.away;
                      if (key === "home")
                        return twoWay > 0
                          ? Math.round((results.home / twoWay) * 100)
                          : 50;
                      if (key === "away") {
                        const h =
                          twoWay > 0
                            ? Math.round((results.home / twoWay) * 100)
                            : 50;
                        return 100 - h;
                      }
                      return 0;
                    })()
                  : displayPcts[key]}
                %
              </span>
            )}
          </button>
        ))}
      </div>

      {phase === "idle" && results?.total === 0 && (
        <p className="text-[10px] text-[#48484A] text-center mt-3">
          {t("firstToPredict")}
        </p>
      )}

      {isVoted && results && results.total >= 50 && (
        <p className="text-[10px] text-[#48484A] text-center mt-3">
          {results.total.toLocaleString()} {t("predictions")}
        </p>
      )}

      {error && (
        <p className="text-[11px] text-[#ff453a] text-center mt-2">{error}</p>
      )}
    </div>
  );
}
