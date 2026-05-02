import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const isAuthError = (() => {
    const err = query.error as { status?: number } | null;
    return err?.status === 401;
  })();

  const value: AuthContextValue = {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data && !isAuthError,
    refresh: async () => {
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
    },
    clear: () => {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
      queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
