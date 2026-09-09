import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

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
  [key: string]: any;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  signIn: (...args: any[]) => Promise<any>;
  signOut: () => Promise<void>;
}

/**
 * Single source of truth for session state, backed by the Convex backend.
 *
 * - `signIn`/`signOut` come from Convex Auth (@convex-dev/auth).
 * - "authenticated" is the JWT-configured Convex session (useAuthToken).
 * - `user` is the signed-in user's `users` table document returned by the
 *   Convex `users.currentUser` query.
 *
 * This replaces the old self-hosted REST retrieval (api.shine.dejoiy.com)
 * which produced tokens the Convex backend could never validate — the cause
 * of "login works, then the app refuses to start".
 */
export function useAuth(): AuthContextType {
  const token = useAuthToken();
  const { signIn, signOut } = useAuthActions();
  const currentUser = useQuery(api.users.currentUser);

  const isAuthenticated = token !== null;
  const user: User | null =
    currentUser !== undefined && currentUser !== null
      ? (currentUser as unknown as User)
      : null;

  // `useAuthToken()` returns null both while the persisted token is still
  // being read (async, from localStorage) and when signed out. Treat the
  // session as "loading" for a brief grace period until either a token
  // appears or the currentUser query settles, so a signed-in user is never
  // flash-redirected to /auth on reload.
  const [sessionResolved, setSessionResolved] = useState(false);
  useEffect(() => {
    if (token !== null || currentUser !== undefined) {
      setSessionResolved(true);
    }
  }, [token, currentUser]);

  const loadingUser =
    isAuthenticated && currentUser === undefined;

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return {
    isLoading: !sessionResolved || loadingUser,
    isAuthenticated: isAuthenticated && currentUser !== undefined && currentUser !== null,
    user,
    signIn: signIn as (...args: any[]) => Promise<any>,
    signOut: handleSignOut,
  };
}