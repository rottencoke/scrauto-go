import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/scores._index";
import { SiteHeader } from "../components/SiteHeader";
import { api, type Score } from "../lib/api";

export function meta({}: Route.MetaArgs) {
  return [{ title: "楽譜一覧 — ScrAuto" }];
}

export default function ScoresIndexPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.listScores();
        setScores(res.scores);
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onDelete(id: number) {
    if (!confirm("この楽譜を削除しますか？")) return;
    try {
      await api.deleteScore(id);
      setScores((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="min-h-screen text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold">楽譜一覧</h1>
            <p className="mt-2 text-white/70">アップロード済みの PDF / 画像</p>
          </div>
          <Link to="/scores/new" className="btn btn-primary">
            新規アップロード
          </Link>
        </div>

        {loading && <p className="opacity-70">読み込み中...</p>}
        {error && <p className="text-[var(--color-warn)]">{error}</p>}

        {!loading && !error && scores.length === 0 && (
          <div className="surface rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold">まだ楽譜がありません</p>
            <p className="mt-2 text-sm opacity-70">PDF または画像をアップロードしてください</p>
            <Link to="/scores/new" className="btn btn-dark mt-6">
              アップロードする
            </Link>
          </div>
        )}

        <ul className="space-y-3">
          {scores.map((score) => (
            <li
              key={score.id}
              className="surface flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
            >
              <div>
                <Link
                  to={`/scores/${score.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {score.title}
                </Link>
                <p className="mt-1 text-sm opacity-65">
                  {score.original_name} · 速度 {score.scroll_speed}px/s
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/scores/${score.id}`} className="btn btn-dark py-2 text-sm">
                  開く
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost py-2 text-sm !text-[var(--color-ink)] !border-[color-mix(in_oklab,var(--color-ink)_20%,transparent)]"
                  onClick={() => void onDelete(score.id)}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
