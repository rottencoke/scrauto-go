import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { Route } from "./+types/scores.$id";
import { SiteHeader } from "../components/SiteHeader";
import {
  SCROLL_SPEED_MAX,
  SCROLL_SPEED_MIN,
  SCROLL_SPEED_STEP,
  clampScrollSpeed,
  useAutoScroll,
} from "../hooks/useAutoScroll";
import { api, type Score } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function meta({}: Route.MetaArgs) {
  return [{ title: "楽譜表示 — ScrAuto" }];
}

export default function ScoreShowPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const scoreId = id ?? "";

  const scoreQuery = useQuery({
    queryKey: queryKeys.score(scoreId),
    queryFn: async () => (await api.getScore(scoreId)).score,
    enabled: Boolean(scoreId),
  });

  const foldersQuery = useQuery({
    queryKey: queryKeys.folders,
    queryFn: async () => (await api.listFolders()).folders,
    enabled: scoreQuery.data?.folder_id != null,
  });

  const fileQuery = useQuery({
    queryKey: queryKeys.scoreFile(scoreId),
    queryFn: ({ signal }) => api.fetchScoreFile(scoreId, signal),
    enabled: Boolean(scoreId) && scoreQuery.isSuccess,
    staleTime: Infinity,
  });

  const score = scoreQuery.data;
  const folderName =
    score?.folder_id != null
      ? (foldersQuery.data?.find((f) => f.id === score.folder_id)?.name ?? null)
      : null;

  const objectUrl = useMemo(() => {
    if (!fileQuery.data) return null;
    return URL.createObjectURL(fileQuery.data);
  }, [fileQuery.data]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const { playing, togglePlaying, speed, setSpeed, scrollerProps } = useAutoScroll({
    enabled: Boolean(objectUrl),
  });

  useEffect(() => {
    if (!score) return;
    setSpeed(clampScrollSpeed(score.scroll_speed));
  }, [score, setSpeed]);

  useEffect(() => {
    if (!score) return;
    document.title = folderName
      ? `${folderName} / ${score.title} — ScrAuto`
      : `${score.title} — ScrAuto`;
  }, [score, folderName]);

  const saveSpeedMutation = useMutation({
    mutationFn: () => api.updateScore(scoreId, { scroll_speed: speed }),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.score(scoreId), res.score);
      queryClient.setQueryData<Score[]>(queryKeys.scores, (prev) =>
        (prev ?? []).map((s) => (s.id === res.score.id ? res.score : s)),
      );
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "保存に失敗しました");
    },
  });

  const renameScoreMutation = useMutation({
    mutationFn: (title: string) => api.updateScore(scoreId, { title }),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.score(scoreId), res.score);
      queryClient.setQueryData<Score[]>(queryKeys.scores, (prev) =>
        (prev ?? []).map((s) => (s.id === res.score.id ? res.score : s)),
      );
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "名前の変更に失敗しました");
    },
  });

  function onRenameScore() {
    if (!score) return;
    const name = prompt("新しい楽譜名", score.title);
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("楽譜名を入力してください");
      return;
    }
    renameScoreMutation.mutate(trimmed);
  }

  const error =
    scoreQuery.error?.message ??
    fileQuery.error?.message ??
    null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-white">
      <SiteHeader />
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5 pb-6">
        <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/scores" className="text-sm text-white/70 hover:text-white">
              ← 一覧へ
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold">
                {score ? (
                  <>
                    {folderName && (
                      <span className="opacity-65">{folderName} / </span>
                    )}
                    {score.title}
                  </>
                ) : (
                  "読み込み中..."
                )}
              </h1>
              {score && (
                <button
                  type="button"
                  className="btn btn-ghost py-1.5 text-sm"
                  onClick={onRenameScore}
                  disabled={renameScoreMutation.isPending}
                >
                  名前変更
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              速度
              <input
                type="range"
                min={SCROLL_SPEED_MIN}
                max={SCROLL_SPEED_MAX}
                step={SCROLL_SPEED_STEP}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                aria-label="スクロール速度（スライダー）"
              />
              <input
                type="number"
                className="field-quiet"
                min={SCROLL_SPEED_MIN}
                max={SCROLL_SPEED_MAX}
                step={SCROLL_SPEED_STEP}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                aria-label="スクロール速度（数値）"
              />
              <span className="text-xs tabular-nums text-white/55">px/s</span>
            </label>
            <button
              type="button"
              className="btn btn-ghost py-2 text-sm"
              onClick={() => saveSpeedMutation.mutate()}
              disabled={saveSpeedMutation.isPending}
            >
              速度を保存
            </button>
            <button
              type="button"
              className="btn btn-primary py-2 text-sm"
              onClick={togglePlaying}
              disabled={!objectUrl}
            >
              {playing ? "停止" : "自動スクロール開始"}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 shrink-0 text-[var(--color-warn)]">{error}</p>}

        <div
          {...scrollerProps}
          className="surface relative min-h-0 flex-1 cursor-pointer overflow-y-auto rounded-2xl select-none"
        >
          {objectUrl && score?.mime_type === "application/pdf" && (
            <PdfPages url={objectUrl} />
          )}
          {objectUrl && score?.mime_type.startsWith("image/") && (
            <img
              src={objectUrl}
              alt={score.title}
              draggable={false}
              className="pointer-events-none mx-auto block w-full max-w-4xl"
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
          urls.push(canvas.toDataURL("image/jpeg", 0.92));
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
        <img
          key={i}
          src={src}
          alt={`page ${i + 1}`}
          draggable={false}
          className="pointer-events-none w-full shadow-sm"
        />
      ))}
    </div>
  );
}
