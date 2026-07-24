import { Link } from "react-router";

import type { Route } from "./+types/home";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../lib/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ScrAuto — 楽譜の自動スクロール" },
    {
      name: "description",
      content: "演奏中の譜めくりを減らす、楽譜・画像の自動スクロールアプリ",
    },
  ];
}

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen text-white">
      <SiteHeader />
      <section className="relative mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-6xl items-end overflow-hidden px-5 pb-16 pt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-8 -z-10 h-[70%] rounded-[2rem] bg-[linear-gradient(135deg,rgba(31,168,160,0.22),rgba(255,255,255,0.04)_40%,transparent)]"
        />
        <div className="max-w-3xl">
          <p className="font-display mb-4 text-5xl font-extrabold tracking-tight sm:text-7xl">
            ScrAuto
          </p>
          <h1 className="max-w-2xl text-2xl font-semibold leading-snug sm:text-3xl">
            演奏に集中するための、楽譜自動スクロール
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            PDFや画像の楽譜をアップロードして、好みの速度で画面を流します。譜めくりの手間を減らして、手元の楽器に戻る時間を増やします。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link to="/scores" className="btn btn-primary">
                楽譜一覧へ
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary">
                  無料で始める
                </Link>
                <Link to="/login" className="btn btn-ghost">
                  ログイン
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
