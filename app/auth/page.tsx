"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Must contain an uppercase letter";
  if (!/[0-9]/.test(pw)) return "Must contain a number";
  return null;
}

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Captcha
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  function resetCaptcha() {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  async function handleSubmit() {
    setMessage(null);

    if (!email.includes("@")) {
      setMessage({ text: "Enter a valid email address", ok: false });
      return;
    }

    if (mode === "signup") {
      const err = validatePassword(password);

      if (err) {
        setMessage({ text: err, ok: false });
        return;
      }
    }

    if (!captchaToken) {
      setMessage({ text: "Please verify you are human.", ok: false });
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken,
          },
        });

        if (error) {
          console.error("Signup:", error.message);

          setMessage({
            text: GENERIC_ERROR,
            ok: false,
          });

          resetCaptcha();
        } else {
          setMessage({
            text: "Check your email to confirm your account.",
            ok: true,
          });

          resetCaptcha();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken,
          },
        });

        if (error) {
          console.error("Login:", error.message);

          setMessage({
            text: "Invalid email or password.",
            ok: false,
          });

          resetCaptcha();
        } else {
          resetCaptcha();

          router.push("/");
        }
      }
    } catch (e) {
      console.error("Auth exception:", e);

      setMessage({
        text: GENERIC_ERROR,
        ok: false,
      });

      resetCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium mb-6">
          {mode === "login" ? "Log in" : "Create account"}
        </h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          disabled={loading}
          className="w-full border rounded-md p-3 mb-3 text-sm"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          disabled={loading}
          className="w-full border rounded-md p-3 mb-4 text-sm"
        />

        {/* Turnstile */}
        <div className="mb-4 flex justify-center">
          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={(token) => {
              setCaptchaToken(token);
              setMessage(null);
            }}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password || !captchaToken}
          className="w-full bg-blue-600 text-white rounded-md p-3 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.ok ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));

            setMessage(null);

            resetCaptcha();
          }}
          className="mt-4 text-sm text-gray-300 underline w-full text-center"
        >
          {mode === "login" ? "Create an account" : "Already have an account"}
        </button>
      </div>
    </div>
  );
}
