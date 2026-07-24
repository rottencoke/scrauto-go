const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export type User = {
  id: number;
  email: string;
};

export type Folder = {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Score = {
  id: number;
  user_id: number;
  folder_id: number | null;
  title: string;
  mime_type: string;
  original_name: string;
  scroll_speed: number;
  created_at: string;
  updated_at: string;
};

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  signup: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
  listFolders: () => request<{ folders: Folder[] }>("/api/folders"),
  createFolder: (name: string) =>
    request<{ folder: Folder }>("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateFolder: (id: string | number, name: string) =>
    request<{ folder: Folder }>(`/api/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteFolder: (id: string | number) =>
    request<{ ok: boolean }>(`/api/folders/${id}`, { method: "DELETE" }),
  listScores: () => request<{ scores: Score[] }>("/api/scores"),
  getScore: (id: string | number) =>
    request<{ score: Score }>(`/api/scores/${id}`),
  createScore: (form: FormData) =>
    request<{ score: Score }>("/api/scores", { method: "POST", body: form }),
  updateScore: (
    id: string | number,
    body: {
      title?: string;
      scroll_speed?: number;
      folder_id?: number;
      clear_folder?: boolean;
    },
  ) =>
    request<{ score: Score }>(`/api/scores/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteScore: (id: string | number) =>
    request<{ ok: boolean }>(`/api/scores/${id}`, { method: "DELETE" }),
  scoreFileUrl: (id: string | number) => `${API_BASE}/api/scores/${id}/file`,
  fetchScoreFile: async (id: string | number, signal?: AbortSignal) => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/scores/${id}/file`, {
      headers,
      credentials: "include",
      signal,
    });
    if (!res.ok) {
      throw new Error("ファイルの取得に失敗しました");
    }
    return res.blob();
  },
  authHeaders: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
