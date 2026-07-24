import { Outlet } from "react-router";

import { Navigate } from "react-router";

import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../lib/auth";

export default function ScoresLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <SiteHeader />
        <p className="px-5 py-16 text-center opacity-80">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
