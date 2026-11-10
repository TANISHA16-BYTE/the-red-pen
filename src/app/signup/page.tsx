"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signupError) throw signupError;

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3] flex items-center justify-center px-5 py-12">
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
          {success ? (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#edf5ed] text-2xl text-[#39734b]">
                ✓
              </div>
              <h1 className="text-2xl font-semibold text-[#242321]">
                Account created.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#77736d]">
                Your account was created, but email confirmation is still enabled in Supabase. Turn off Confirm Email there to allow direct signup.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#a83232]">
                YOUR WORKSPACE STARTS HERE
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#242321]">
                Create your account.
              </h1>
              <p className="mt-2 text-sm text-[#77736d]">
                Bring clarity and consistency to every brand decision.
              </p>

              <form onSubmit={handleSignup} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-[#393733]">
                    Full name
                  </label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#393733]">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#393733]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#393733]">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter your password again"
                    className="w-full rounded-lg border border-[#dedad3] px-4 py-3 text-sm text-[#242321] outline-none transition focus:border-[#a83232] focus:ring-2 focus:ring-[#a83232]/10"
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#a83232] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#8f2929] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-[#89857e]">
                Create your account with your email and password.
              </p>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-[#89857e]">
          The Red Pen · Make every word accountable.
        </p>
      </div>
    </main>
  );
}
