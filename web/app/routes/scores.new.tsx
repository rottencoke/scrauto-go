import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import type { Route } from "./+types/scores.new";
import { SiteHeader } from "../components/SiteHeader";
import {
  SCROLL_SPEED_MAX,
  SCROLL_SPEED_MIN,
  SCROLL_SPEED_STEP,
  clampScrollSpeed,
} from "../hooks/useAutoScroll";
import { api, type Folder } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function meta({}: Route.MetaArgs) {
  return [{ title: "新規アップロード — ScrAuto" }];
}

type FolderMode = "none" | "existing" | "new";

export default function ScoresNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [speed, setSpeed] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [folderMode, setFolderMode] = useState<FolderMode>("none");
  const [selectedFolderId, setSelectedFolderId] = useState<number | "">("");
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const foldersQuery = useQuery({
    queryKey: queryKeys.folders,
    queryFn: async () => (await api.listFolders()).folders,
  });
  const folders = foldersQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("ファイルを選択してください");
      }
      if (folderMode === "existing" && selectedFolderId === "") {
        throw new Error("フォルダーを選択してください");
      }
      if (folderMode === "new" && !newFolderName.trim()) {
        throw new Error("フォルダー名を入力してください");
      }

      let folderId: number | undefined;
      if (folderMode === "new") {
        const created = await api.createFolder(newFolderName.trim());
        folderId = created.folder.id;
        queryClient.setQueryData<Folder[]>(queryKeys.folders, (prev) =>
          [...(prev ?? []), created.folder].sort((a, b) =>
            a.name.localeCompare(b.name, "ja"),
          ),
        );
      } else if (folderMode === "existing" && selectedFolderId !== "") {
        folderId = selectedFolderId;
      }

      const form = new FormData();
      form.append("title", title);
      form.append("scroll_speed", String(clampScrollSpeed(speed)));
      form.append("file", file);
      if (folderId != null) {
        form.append("folder_id", String(folderId));
      }
      return api.createScore(form);
    },
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.score(res.score.id), res.score);
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores });
      navigate(`/scores/${res.score.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="min-h-screen text-white">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-10">
        <div className="surface rounded-2xl p-8 shadow-xl">
          <h1 className="font-display text-3xl font-bold">楽譜をアップロード</h1>
          <p className="mt-2 text-sm opacity-70">PDF / JPEG / PNG / WebP / GIF</p>
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="label" htmlFor="title">
                タイトル
              </label>
              <input
                id="title"
                className="field"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="file">
                ファイル
              </label>
              <input
                id="file"
                className="field"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <fieldset>
              <legend className="label">フォルダー（任意）</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="folderMode"
                    checked={folderMode === "none"}
                    onChange={() => setFolderMode("none")}
                  />
                  フォルダーに入れない
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="folderMode"
                    checked={folderMode === "existing"}
                    onChange={() => setFolderMode("existing")}
                    disabled={folders.length === 0}
                  />
                  既存フォルダーを選択
                </label>
                {folderMode === "existing" && (
                  <select
                    className="field"
                    value={selectedFolderId}
                    onChange={(e) =>
                      setSelectedFolderId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    required
                  >
                    <option value="">選択してください</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="folderMode"
                    checked={folderMode === "new"}
                    onChange={() => setFolderMode("new")}
                  />
                  新しいフォルダーを作成して入れる
                </label>
                {folderMode === "new" && (
                  <input
                    className="field"
                    placeholder="フォルダー名"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    required
                  />
                )}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="speed">
                初期スクロール速度（px/秒）
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="speed"
                  className="w-full"
                  type="range"
                  min={SCROLL_SPEED_MIN}
                  max={SCROLL_SPEED_MAX}
                  step={SCROLL_SPEED_STEP}
                  value={speed}
                  onChange={(e) => setSpeed(clampScrollSpeed(Number(e.target.value)))}
                  aria-label="初期スクロール速度（スライダー）"
                />
                <input
                  type="number"
                  className="field-quiet"
                  min={SCROLL_SPEED_MIN}
                  max={SCROLL_SPEED_MAX}
                  step={SCROLL_SPEED_STEP}
                  value={speed}
                  onChange={(e) => setSpeed(clampScrollSpeed(Number(e.target.value)))}
                  aria-label="初期スクロール速度（数値）"
                />
              </div>
            </div>
            {error && <p className="text-sm text-[var(--color-warn)]">{error}</p>}
            <button
              className="btn btn-dark w-full"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "アップロード中..." : "アップロード"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
