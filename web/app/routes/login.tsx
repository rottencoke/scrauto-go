import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import type { Route } from "./+types/login";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../lib/auth";

export function meta({}: Route.MetaArgs) {
  return [{ title: "ログイン — ScrAuto" }];
}

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/scores" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/scores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-white">
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-12">
        <div className="surface rounded-2xl p-8 shadow-xl">
          <h1 className="font-display text-3xl font-bold">ログイン</h1>
          <p className="mt-2 text-sm opacity-70">登録済みのメールでサインイン</p>
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="label" htmlFor="email">
                メールアドレス
              </label>
              <input
                id="email"
                className="field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                パスワード
              </label>
              <input
                id="password"
                className="field"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-[var(--color-warn)]">{error}</p>}
            <button className="btn btn-dark w-full" type="submit" disabled={submitting}>
              {submitting ? "送信中..." : "ログイン"}
            </button>
          </form>
          <p className="mt-6 text-sm opacity-70">
            アカウント未作成の方は{" "}
            <Link to="/signup" className="font-semibold text-[var(--color-accent-deep)]">
              新規登録
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
