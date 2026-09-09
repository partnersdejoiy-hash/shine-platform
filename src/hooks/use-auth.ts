import { useCallback, useEffect, useState } from "react";
import { api as shineApi } from "@/hooks/use-api";

export interface User {
  _id: string;
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
  image?: string;
  orgId?: string;
  status?: string;
  mustChangePassword?: boolean;
  accentColor?: string;
  notificationPrefs?: any;
  soundPrefs?: any;
  customSoundUrl?: string;
  approvedPermissions?: string[];
  isActive?: boolean;
  employeeId?: string;
  designation?: string;
  department?: string;
  company?: string;
  [key: string]: any;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  signIn: (...args: any[]) => Promise<any>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

/**
 * Single source of truth for session state, backed by the self-hosted
 * NestJS API (JWT auth).
 *
 * - `signIn`/`signOut` call the API auth endpoints.
 * - "authenticated" is driven by the presence of a valid JWT.
 * - `user` is the current user profile returned by GET /api/auth/me.
 */
export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restore = useCallback(async () => {
    const token = shineApi.loadTokens();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const me = await shineApi.request("/api/auth/me");
      if (me && (me.id || me._id)) {
        const u = {
          _id: me.id || me._id,
          ...me,
        } as User;
        setUser(u);
      } else {
        shineApi.clearTokens();
        setUser(null);
      }
    } catch {
      // Token invalid/expired — try refresh then clear
      shineApi.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const signIn = useCallback(
    async (method: "password" | "otp" | "magic", payload: any) => {
      if (method === "password") {
        const res = await shineApi.request("/api/auth/login", {
          method: "POST",
          body: { email: payload.email, password: payload.password },
        });
        shineApi.setTokens(res.accessToken, res.refreshToken);
        const me = await shineApi.request("/api/auth/me");
        setUser({ _id: me.id || me._id, ...me } as User);
        return { user: me };
      }
      if (method === "magic") {
        const res = await shineApi.request("/api/auth/magic-link", {
          method: "POST",
          body: { email: payload.email },
        });
        return res;
      }
      throw new Error("Unknown auth method");
    },
    [],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await shineApi.request("/api/auth/logout", { method: "POST" });
    } catch {}
    shineApi.clearTokens();
    setUser(null);
  }, []);

  return {
    isLoading,
    isAuthenticated: !!user,
    user,
    signIn,
    signOut: handleSignOut,
    restore,
  };
}