const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export type User = {
  id: number;
  email: string;
};

export type Score = {
  id: number;
  user_id: number;
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
  listScores: () => request<{ scores: Score[] }>("/api/scores"),
  getScore: (id: string | number) =>
    request<{ score: Score }>(`/api/scores/${id}`),
  createScore: (form: FormData) =>
    request<{ score: Score }>("/api/scores", { method: "POST", body: form }),
  updateScore: (
    id: string | number,
    body: { title?: string; scroll_speed?: number },
  ) =>
    request<{ score: Score }>(`/api/scores/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteScore: (id: string | number) =>
    request<{ ok: boolean }>(`/api/scores/${id}`, { method: "DELETE" }),
  scoreFileUrl: (id: string | number) => `${API_BASE}/api/scores/${id}/file`,
  authHeaders: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
