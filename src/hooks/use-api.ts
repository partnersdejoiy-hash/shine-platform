import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.shine.dejoiy.com";

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ShineAPI {
  private token: string | null = null;
  private refreshToken: string | null = null;

  setTokens(access: string, refresh: string) {
    this.token = access;
    this.refreshToken = refresh;
    try {
      localStorage.setItem("shine_access_token", access);
      localStorage.setItem("shine_refresh_token", refresh);
    } catch {}
  }

  loadTokens() {
    try {
      this.token = localStorage.getItem("shine_access_token");
      this.refreshToken = localStorage.getItem("shine_refresh_token");
    } catch {}
    return this.token;
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    try {
      localStorage.removeItem("shine_access_token");
      localStorage.removeItem("shine_refresh_token");
    } catch {}
  }

  async request<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && this.refreshToken) {
      // Try refreshing
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          this.setTokens(data.accessToken, data.refreshToken);
          headers["Authorization"] = `Bearer ${data.accessToken}`;
          const retryRes = await fetch(`${API_BASE}${path}`, {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });
          if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
          return retryRes.json();
        }
      } catch {}
      this.clearTokens();
      throw new Error("Session expired");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message || `API error: ${res.status}`);
    }
    return res.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request("/api/auth/login", { method: "POST", body: { email, password } });
  }
  register(data: { email: string; password: string; name: string }) {
    return this.request("/api/auth/register", { method: "POST", body: data });
  }
  getMe() { return this.request("/api/auth/me"); }
  logout() { return this.request("/api/auth/logout", { method: "POST" }); }
  changePassword(oldPassword: string, newPassword: string) {
    return this.request("/api/auth/change-password", { method: "POST", body: { oldPassword, newPassword } });
  }
  forgotPassword(email: string) {
    return this.request("/api/auth/forgot-password", { method: "POST", body: { email } });
  }
  resetPassword(email: string, code: string, newPassword: string) {
    return this.request("/api/auth/reset-password", { method: "POST", body: { email, code, newPassword } });
  }

  // Users
  getUser(id: string) { return this.request(`/api/users/${id}`); }
  searchUsers(q: string) { return this.request(`/api/users/search?q=${encodeURIComponent(q)}`); }
  getDirectory() { return this.request("/api/users/directory"); }
  updateProfile(data: any) { return this.request("/api/users/me", { method: "PATCH", body: data }); }
  getMyOrgs() { return this.request("/api/users/my-orgs"); }
  getPresence(userId: string) { return this.request(`/api/users/presence/${userId}`); }

  // Conversations
  getConversations() { return this.request("/api/conversations"); }
  getUnreadCount() { return this.request("/api/conversations/unread-count"); }
  createDirect(userId: string) { return this.request("/api/conversations/direct", { method: "POST", body: { userId } }); }
  createGroup(data: any) { return this.request("/api/conversations/group", { method: "POST", body: data }); }
  createChannel(data: any) { return this.request("/api/conversations/channel", { method: "POST", body: data }); }
  getConversation(id: string) { return this.request(`/api/conversations/${id}`); }
  getMembers(id: string) { return this.request(`/api/conversations/${id}/members`); }
  joinChannel(id: string) { return this.request(`/api/conversations/${id}/join`, { method: "POST" }); }
  leaveChannel(id: string) { return this.request(`/api/conversations/${id}/leave`, { method: "POST" }); }
  markRead(id: string) { return this.request(`/api/conversations/${id}/read`, { method: "PUT" }); }

  // Messages
  sendMessage(data: any) { return this.request("/api/messages", { method: "POST", body: data }); }
  getMessages(convId: string, limit = 50, before?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    return this.request(`/api/messages/conversation/${convId}?${params}`);
  }
  getThread(parentId: string) { return this.request(`/api/messages/thread/${parentId}`); }
  editMessage(id: string, body: string) { return this.request(`/api/messages/${id}`, { method: "PUT", body: { body } }); }
  deleteMessage(id: string) { return this.request(`/api/messages/${id}`, { method: "DELETE" }); }
  searchMessages(q: string) { return this.request(`/api/messages/search?q=${encodeURIComponent(q)}`); }
  forwardMessage(id: string, toConversationId: string) {
    return this.request(`/api/messages/${id}/forward`, { method: "POST", body: { toConversationId } });
  }

  // Meetings
  getMeetings() { return this.request("/api/meetings"); }
  createMeeting(data: any) { return this.request("/api/meetings", { method: "POST", body: data }); }
  joinMeeting(id: string) { return this.request(`/api/meetings/${id}/join`, { method: "POST" }); }

  // Notifications
  getNotifications() { return this.request("/api/notifications"); }
  getUnreadNotifications() { return this.request("/api/notifications/unread-count"); }
  markNotificationRead(id: string) { return this.request(`/api/notifications/${id}/read`, { method: "POST" }); }
  markAllNotificationsRead() { return this.request("/api/notifications/read-all", { method: "POST" }); }

  // Files
  getFiles() { return this.request("/api/files"); }

  // Tasks
  getTasks(orgId: string) { return this.request(`/api/tasks?orgId=${orgId}`); }
  createTask(data: any) { return this.request("/api/tasks", { method: "POST", body: data }); }

  // Tickets
  getTickets() { return this.request("/api/tickets"); }
  createTicket(data: any) { return this.request("/api/tickets", { method: "POST", body: data }); }
  getTicket(id: string) { return this.request(`/api/tickets/${id}`); }

  // Policies
  getPolicies() { return this.request("/api/policies"); }
  createPolicy(data: any) { return this.request("/api/policies", { method: "POST", body: data }); }
  acknowledgePolicy(id: string) { return this.request(`/api/policies/${id}/acknowledge`, { method: "POST" }); }
  getPendingAcks() { return this.request("/api/policies/pending-acks"); }

  // Admin
  getAdminStats() { return this.request("/api/admin/stats"); }
  adminListUsers(limit?: number, offset?: number, search?: string) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    if (search) params.set("search", search);
    return this.request(`/api/admin/users?${params}`);
  }
  adminListOrgs() { return this.request("/api/admin/orgs"); }

  // Organizations
  getOrgs() { return this.request("/api/orgs"); }

  // Contacts
  getContacts() { return this.request("/api/contacts"); }
  searchContacts(q: string) { return this.request(`/api/contacts/search?q=${encodeURIComponent(q)}`); }

  // Audit
  getAuditLogs(orgId?: string) {
    const params = orgId ? `?orgId=${orgId}` : "";
    return this.request(`/api/audit${params}`);
  }

  // Search
  globalSearch(q: string) { return this.request(`/api/search?q=${encodeURIComponent(q)}`); }

  // Permissions
  getRoles() { return this.request("/api/permissions/roles"); }
}

export const api = new ShineAPI();

// React hooks
export function useApiQuery<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.request(path)
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, ...deps]);

  return { data, loading, error };
}

export function useApiMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (path: string, options?: ApiOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.request(path, options);
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}
