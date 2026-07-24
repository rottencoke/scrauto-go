import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import type { Route } from "./+types/scores._index";
import { SiteHeader } from "../components/SiteHeader";
import { api, type Folder, type Score } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function meta({}: Route.MetaArgs) {
  return [{ title: "楽譜一覧 — ScrAuto" }];
}

export default function ScoresIndexPage() {
  const queryClient = useQueryClient();
  const [newFolderName, setNewFolderName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const scoresQuery = useQuery({
    queryKey: queryKeys.scores,
    queryFn: async () => (await api.listScores()).scores,
  });

  const foldersQuery = useQuery({
    queryKey: queryKeys.folders,
    queryFn: async () => (await api.listFolders()).folders,
  });

  const scores = scoresQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const loading = scoresQuery.isPending || foldersQuery.isPending;
  const error =
    scoresQuery.error?.message ?? foldersQuery.error?.message ?? null;

  const deleteScoreMutation = useMutation({
    mutationFn: (id: number) => api.deleteScore(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Score[]>(queryKeys.scores, (prev) =>
        (prev ?? []).filter((s) => s.id !== id),
      );
      void queryClient.removeQueries({ queryKey: queryKeys.score(id) });
      void queryClient.removeQueries({ queryKey: queryKeys.scoreFile(id) });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.createFolder(name),
    onSuccess: (res) => {
      queryClient.setQueryData<Folder[]>(queryKeys.folders, (prev) =>
        [...(prev ?? []), res.folder].sort((a, b) =>
          a.name.localeCompare(b.name, "ja"),
        ),
      );
      setNewFolderName("");
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folder: Folder) => api.deleteFolder(folder.id),
    onSuccess: (_data, folder) => {
      queryClient.setQueryData<Folder[]>(queryKeys.folders, (prev) =>
        (prev ?? []).filter((f) => f.id !== folder.id),
      );
      queryClient.setQueryData<Score[]>(queryKeys.scores, (prev) =>
        (prev ?? []).map((s) =>
          s.folder_id === folder.id ? { ...s, folder_id: null } : s,
        ),
      );
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.updateFolder(id, name),
    onSuccess: (res) => {
      queryClient.setQueryData<Folder[]>(queryKeys.folders, (prev) =>
        (prev ?? [])
          .map((f) => (f.id === res.folder.id ? res.folder : f))
          .sort((a, b) => a.name.localeCompare(b.name, "ja")),
      );
    },
  });

  const moveScoreMutation = useMutation({
    mutationFn: ({
      scoreId,
      value,
    }: {
      scoreId: number;
      value: string;
    }) =>
      value === ""
        ? api.updateScore(scoreId, { clear_folder: true })
        : api.updateScore(scoreId, { folder_id: Number(value) }),
    onSuccess: (res) => {
      queryClient.setQueryData<Score[]>(queryKeys.scores, (prev) =>
        (prev ?? []).map((s) => (s.id === res.score.id ? res.score : s)),
      );
      queryClient.setQueryData(queryKeys.score(res.score.id), res.score);
    },
  });

  const unfiledScores = useMemo(
    () => scores.filter((s) => s.folder_id == null),
    [scores],
  );

  const scoresByFolder = useMemo(() => {
    const map = new Map<number, Score[]>();
    for (const folder of folders) {
      map.set(folder.id, []);
    }
    for (const score of scores) {
      if (score.folder_id == null) continue;
      const list = map.get(score.folder_id);
      if (list) list.push(score);
    }
    return map;
  }, [scores, folders]);

  const orphanScores = useMemo(() => {
    const folderIds = new Set(folders.map((f) => f.id));
    return scores.filter(
      (s) => s.folder_id != null && !folderIds.has(s.folder_id),
    );
  }, [scores, folders]);

  function onDelete(id: number) {
    if (!confirm("この楽譜を削除しますか？")) return;
    deleteScoreMutation.mutate(id, {
      onError: (err) => {
        alert(err instanceof Error ? err.message : "削除に失敗しました");
      },
    });
  }

  function onAddFolder(e: FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    createFolderMutation.mutate(name, {
      onError: (err) => {
        alert(err instanceof Error ? err.message : "フォルダーの作成に失敗しました");
      },
    });
  }

  function onDeleteFolder(folder: Folder) {
    if (
      !confirm(
        `フォルダー「${folder.name}」を削除しますか？\n中の楽譜はフォルダーなしに移ります。`,
      )
    ) {
      return;
    }
    deleteFolderMutation.mutate(folder, {
      onError: (err) => {
        alert(err instanceof Error ? err.message : "フォルダーの削除に失敗しました");
      },
    });
  }

  function onRenameFolder(folder: Folder) {
    const name = prompt("新しいフォルダー名", folder.name);
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("フォルダー名を入力してください");
      return;
    }
    renameFolderMutation.mutate(
      { id: folder.id, name: trimmed },
      {
        onError: (err) => {
          alert(err instanceof Error ? err.message : "名前の変更に失敗しました");
        },
      },
    );
  }

  function onMoveScore(scoreId: number, value: string) {
    moveScoreMutation.mutate(
      { scoreId, value },
      {
        onError: (err) => {
          alert(err instanceof Error ? err.message : "移動に失敗しました");
        },
      },
    );
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderScoreItem(score: Score) {
    return (
      <li
        key={score.id}
        className="surface flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4"
      >
        <div className="min-w-0 flex-1">
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
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`move-${score.id}`}>
            フォルダーへ移動
          </label>
          <select
            id={`move-${score.id}`}
            className="field !w-auto !py-2 text-sm"
            value={score.folder_id ?? ""}
            onChange={(e) => onMoveScore(score.id, e.target.value)}
            aria-label="フォルダーへ移動"
          >
            <option value="">フォルダーなし</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <Link to={`/scores/${score.id}`} className="btn btn-dark py-2 text-sm">
            開く
          </Link>
          <button
            type="button"
            className="btn btn-ghost py-2 text-sm !text-[var(--color-ink)] !border-[color-mix(in_oklab,var(--color-ink)_20%,transparent)]"
            onClick={() => onDelete(score.id)}
          >
            削除
          </button>
        </div>
      </li>
    );
  }

  function renderSection(
    key: string,
    title: string,
    items: Score[],
    folder?: Folder,
  ) {
    const isCollapsed = collapsed[key] ?? false;
    return (
      <section key={key} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => toggleCollapsed(key)}
            aria-expanded={!isCollapsed}
          >
            <span className="text-sm opacity-60" aria-hidden>
              {isCollapsed ? "▸" : "▾"}
            </span>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <span className="text-sm opacity-55">({items.length})</span>
          </button>
          {folder && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost py-1.5 text-sm !text-[var(--color-ink)] !border-[color-mix(in_oklab,var(--color-ink)_20%,transparent)]"
                onClick={() => onRenameFolder(folder)}
              >
                名前変更
              </button>
              <button
                type="button"
                className="btn btn-ghost py-1.5 text-sm !text-[var(--color-ink)] !border-[color-mix(in_oklab,var(--color-ink)_20%,transparent)]"
                onClick={() => onDeleteFolder(folder)}
              >
                削除
              </button>
            </div>
          )}
        </div>
        {!isCollapsed &&
          (items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/20 px-5 py-6 text-sm opacity-60">
              このフォルダーに楽譜はありません
            </p>
          ) : (
            <ul className="space-y-3">{items.map(renderScoreItem)}</ul>
          ))}
      </section>
    );
  }

  const isEmpty = !loading && !error && scores.length === 0 && folders.length === 0;

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

        <form
          className="surface mb-8 flex flex-wrap items-end gap-3 rounded-xl px-5 py-4"
          onSubmit={onAddFolder}
        >
          <div className="min-w-[12rem] flex-1">
            <label className="label" htmlFor="new-folder">
              フォルダーを追加
            </label>
            <input
              id="new-folder"
              className="field"
              placeholder="フォルダー名"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-dark"
            disabled={createFolderMutation.isPending || !newFolderName.trim()}
          >
            {createFolderMutation.isPending ? "追加中..." : "追加"}
          </button>
        </form>

        {loading && <p className="opacity-70">読み込み中...</p>}
        {error && <p className="text-[var(--color-warn)]">{error}</p>}

        {isEmpty && (
          <div className="surface rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold">まだ楽譜がありません</p>
            <p className="mt-2 text-sm opacity-70">PDF または画像をアップロードしてください</p>
            <Link to="/scores/new" className="btn btn-dark mt-6">
              アップロードする
            </Link>
          </div>
        )}

        {!loading && !error && !isEmpty && (
          <div className="space-y-10">
            {folders.map((folder) =>
              renderSection(
                `folder-${folder.id}`,
                folder.name,
                scoresByFolder.get(folder.id) ?? [],
                folder,
              ),
            )}
            {renderSection(
              "unfiled",
              "フォルダーなし",
              [...unfiledScores, ...orphanScores],
            )}
          </div>
        )}
      </main>
    </div>
  );
}
