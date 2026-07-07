"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConfirmState = "loading" | "confirmed" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function AuthConfirmPage() {
  const [state, setState] = useState<ConfirmState>("loading");
  const [message, setMessage] = useState("Confirming your login...");

  useEffect(() => {
    let cancelled = false;

    async function confirmLogin() {
      try {
        const params = new URLSearchParams(window.location.search);
        const loginId = params.get("pc_login");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = params.get("code");

        let session: Session | null = null;

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          session = data.session;
        } else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          session = data.session;
        } else {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session?.access_token || !session.refresh_token) {
          throw new Error("No login session was created.");
        }

        if (loginId) {
          const response = await fetch(`${apiBaseUrl}/auth/device-confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: session.access_token,
              email: session.user.email,
              loginId,
              refreshToken: session.refresh_token,
            }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error || "Could not confirm the computer login.");
          }
        }

        if (cancelled) {
          return;
        }

        setState("confirmed");
        setMessage(
          loginId
            ? "Confirmed. Your computer will sign in automatically."
            : "Confirmed. Redirecting..."
        );

        window.setTimeout(() => {
          if (loginId) {
            window.close();
          } else {
            window.location.replace("/");
          }
        }, 1600);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState("failed");
        setMessage(error instanceof Error ? error.message : "Could not confirm your login.");
      }
    }

    confirmLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  const Icon = state === "loading" ? Loader2 : state === "confirmed" ? CheckCircle2 : XCircle;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071713] px-4 text-[#fff8e7]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src="/socialwinia-background.jpg"
          alt=""
          className="h-full w-full translate-y-40 object-cover object-top opacity-75 saturate-150"
        />
        <div className="absolute inset-0 bg-[#06120f]/58" />
      </div>
      <section className="relative z-10 w-full max-w-md rounded-md border border-[#1f6f58] bg-[#12372d]/92 p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur">
        <img
          src="/socialwinia-logo.png"
          alt="SocialWinia"
          className="mx-auto mb-5 h-20 w-auto max-w-[260px] object-contain"
        />
        <Icon
          className={`mx-auto mb-4 ${
            state === "loading"
              ? "animate-spin text-[#ffd23f]"
              : state === "confirmed"
                ? "text-[#70d6bf]"
                : "text-[#ff5b8d]"
          }`}
          size={42}
        />
        <h1 className="text-2xl font-bold">
          {state === "failed" ? "Login could not be confirmed" : "Login confirmation"}
        </h1>
        <p className="mt-3 text-[#cbe7d6]">{message}</p>
        {state === "confirmed" && (
          <p className="mt-3 text-sm text-[#ffd23f]">You can return to your computer now.</p>
        )}
      </section>
    </main>
  );
}
