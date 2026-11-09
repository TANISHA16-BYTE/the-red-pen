"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) throw loginError;

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f3] px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#a83232] text-xl font-bold text-white">
            R.
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight text-[#242321]">
              the red pen<span className="text-[#a83232]">.</span>
            </span>
            <span className="text-[10px] tracking-[0.2em] text-[#89857e]">
              BRAND GOVERNANCE
            </span>
          </span>
        </Link>

        <section className="rounded-2xl border border-[#e9e5de] bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#a83232]">
            WELCOME BACK
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#242321]">
            Sign in.
          </h1>

          <p className="mt-2 text-sm text-[#77736d]">
            Continue managing your brand with confidence.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#393733]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#393733]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#a83232] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#8f2929] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#77736d]">
            New to The Red Pen?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#a83232] hover:underline"
            >
              Create an account
            </Link>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-[#89857e]">
          The Red Pen · Make every word accountable.
        </p>
      </div>
    </main>
  );
}
