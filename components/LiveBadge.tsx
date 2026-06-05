"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

function AnimatedNumber({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== display) {
      setAnimate(true);

      const timeout = setTimeout(() => {
        setDisplay(value);
        setAnimate(false);
      }, 180);

      return () => clearTimeout(timeout);
    }
  }, [value, display]);

  return (
    <div className="relative h-8 overflow-hidden">
      <span
        className={`block transition-all duration-200 ${
          animate ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {display}
      </span>

      {animate && (
        <span className="absolute inset-0 translate-y-6 animate-[slideUp_180ms_ease-out_forwards]">
          {value}
        </span>
      )}
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const formatted = String(value).padStart(2, "0");

  return (
    <div className="flex items-end gap-1">
      <AnimatedNumber value={formatted} />
      <span className="text-xs text-gray-300 mb-05">{label}</span>
    </div>
  );
}

export default function LiveBadge() {
  const t = useTranslations("liveBadge");
  // Montenegro time (CEST UTC+2)
  const targetDate = useMemo(() => new Date("2026-06-11T21:00:00+02:00"), []);

  const calculateTime = () => {
    const now = new Date().getTime();
    const difference = targetDate.getTime() - now;

    if (difference <= 0) {
      return null;
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calculateTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/league/1"
      className="relative w-full overflow-hidden rounded-md block"
    >
      <img
        src="/images/Banner.svg"
        alt="World Cup Banner"
        className="w-full h-auto object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/15" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        {/* Badge + title — left, vertically centered */}
        <div className="flex items-center gap-3">
          <img
            src="/images/WC26Badge.svg"
            alt="WC26 Badge"
            className="h-8 sm:h-15 w-auto object-contain"
          />
          <span className="text-white font-bold text-sm leading-tight tracking-wide">
            {t("worldCup")}
          </span>
        </div>

        {/* Countdown — right, vertically centered */}
        {timeLeft ? (
          <div className="flex items-center gap-3 text-white font-bold text-2xl">
            <CountdownUnit value={timeLeft.days} label={t("days")} />
            <span className="opacity-40">|</span>
            <CountdownUnit value={timeLeft.hours} label={t("hours")} />
            <span className="opacity-40">|</span>
            <CountdownUnit value={timeLeft.minutes} label={t("minutes")} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-semibold text-lg">
              {t("followNews")}
            </span>
          </div>
        )}
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(24px);
            opacity: 0;
          }

          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </Link>
  );
}
