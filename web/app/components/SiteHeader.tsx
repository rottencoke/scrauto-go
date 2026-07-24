import { Link, NavLink } from "react-router";

import { useAuth } from "../lib/auth";

export function SiteHeader() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 text-white">
      <Link to="/" className="font-display text-2xl font-bold tracking-tight">
        ScrAuto
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {!loading && user ? (
          <>
            <NavLink
              to="/scores"
              className={({ isActive }) =>
                isActive ? "underline underline-offset-4" : "opacity-85 hover:opacity-100"
              }
            >
              楽譜一覧
            </NavLink>
            <NavLink to="/scores/new" className="btn btn-primary py-2 text-sm">
              新規アップロード
            </NavLink>
            <button
              type="button"
              className="btn btn-ghost py-2 text-sm"
              onClick={() => void logout()}
            >
              ログアウト
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="opacity-85 hover:opacity-100">
              ログイン
            </Link>
            <Link to="/signup" className="btn btn-primary py-2 text-sm">
              新規登録
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
