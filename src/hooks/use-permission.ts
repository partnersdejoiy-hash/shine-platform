import { api } from "@/convex/api";
import { permAllowed, type PermValue } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@/convex/react";

/**
 * Expose the signed-in user's effective permissions (role defaults + admin
 * overrides + individually approved permission requests) for UI gating.
 *
 *   const { can } = usePermission();
 *   if (!can("start_meeting")) return null;
 */
export function usePermission() {
  const { user } = useAuth();
  const map = useQuery(api.permissions.myPermissionMap);

  function can(permission: string): boolean {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    if (user.approvedPermissions?.includes(permission)) return true;
    const value: PermValue | undefined = map?.permissions?.[permission];
    return permAllowed(value);
  }

  return { can, loading: !map, map };
}
