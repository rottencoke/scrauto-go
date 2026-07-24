import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { Route } from "./+types/scores.$id";
import { SiteHeader } from "../components/SiteHeader";
import { api, type Score } from "../lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function meta({}: Route.MetaArgs) {
  return [{ title: "楽譜表示 — ScrAuto" }];
}

export default function ScoreShowPage() {
  const { id } = useParams();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40);
  const playingRef = useRef(false);
  const speedRef = useRef(40);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!id) return;
    let revoked: string | null = null;
    void (async () => {
      try {
        const res = await api.getScore(id);
        setScore(res.score);
        setSpeed(res.score.scroll_speed);

        const fileRes = await fetch(api.scoreFileUrl(id), {
          headers: api.authHeaders(),
          credentials: "include",
        });
        if (!fileRes.ok) throw new Error("ファイルの取得に失敗しました");
        const blob = await fileRes.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);

  const tick = useCallback((ts: number) => {
    if (!playingRef.current) {
      lastTsRef.current = null;
      rafRef.current = null;
      return;
    }
    const el = scrollerRef.current;
    if (!el) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (lastTsRef.current == null) {
      lastTsRef.current = ts;
    } else {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      el.scrollTop += speedRef.current * dt;
      const max = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= max - 1) {
        playingRef.current = false;
        setPlaying(false);
        lastTsRef.current = null;
        rafRef.current = null;
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  async function saveSpeed() {
    if (!id) return;
    try {
      const res = await api.updateScore(id, { scroll_speed: speed });
      setScore(res.score);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-white">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/scores" className="text-sm text-white/70 hover:text-white">
              ← 一覧へ
            </Link>
            <h1 className="font-display mt-1 text-3xl font-bold">
              {score?.title ?? "読み込み中..."}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              速度
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span className="w-16 tabular-nums">{speed}px/s</span>
            </label>
            <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => void saveSpeed()}>
              速度を保存
            </button>
            <button
              type="button"
              className="btn btn-primary py-2 text-sm"
              onClick={() => setPlaying((p) => !p)}
              disabled={!objectUrl}
            >
              {playing ? "停止" : "自動スクロール開始"}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-[var(--color-warn)]">{error}</p>}

        <div
          ref={scrollerRef}
          className="surface relative min-h-[70vh] flex-1 overflow-auto rounded-2xl"
        >
          {objectUrl && score?.mime_type === "application/pdf" && (
            <PdfPages url={objectUrl} />
          )}
          {objectUrl && score?.mime_type.startsWith("image/") && (
            <img
              src={objectUrl}
              alt={score.title}
              className="mx-auto block w-full max-w-4xl"
            />
          )}
          {!objectUrl && !error && (
            <p className="p-10 text-center opacity-60">ファイルを読み込み中...</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PdfPages({ url }: { url: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void (async () => {
      try {
        const doc = await pdfjs.getDocument(url).promise;
        const urls: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const pageUrl = canvas.toDataURL("image/jpeg", 0.92);
          created.push(pageUrl);
          urls.push(pageUrl);
        }
        if (!cancelled) setPages(urls);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "PDFの表示に失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return <p className="p-8 text-[var(--color-warn)]">{error}</p>;
  }
  if (pages.length === 0) {
    return <p className="p-10 text-center opacity-60">PDFを描画中...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`page ${i + 1}`} className="w-full shadow-sm" />
      ))}
    </div>
  );
}
