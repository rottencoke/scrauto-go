import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setToken, type User } from "./api";
import { queryKeys } from "./query-keys";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    return await api.me();
  } catch {
    setToken(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (res) => {
      setToken(res.token);
      queryClient.setQueryData(queryKeys.me, res.user);
    },
  });

  const signupMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.signup(email, password),
    onSuccess: (res) => {
      setToken(res.token);
      queryClient.setQueryData(queryKeys.me, res.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSettled: async () => {
      setToken(null);
      queryClient.setQueryData(queryKeys.me, null);
      await queryClient.resetQueries({ queryKey: queryKeys.scores });
      await queryClient.resetQueries({ queryKey: queryKeys.folders });
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      await signupMutation.mutateAsync({ email, password });
    },
    [signupMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isPending,
      login,
      signup,
      logout,
    }),
    [meQuery.data, meQuery.isPending, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
