/** Barada mobile — API layer over the shared backend. */

/** Production backend — reachable from mobile data AND home WiFi. */
export const API = "https://barada-code.vercel.app";
/** Local dev fallback: export const API = "http://192.168.0.134:3000"; */

/** fetch with a hard timeout — a dead server must surface as an error, never an infinite spinner. */
export function apiFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  return fetch(`${API}${url}`, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => apiFetch(`/api/auth/me`).then(json),
  signin: (email, password) =>
    apiFetch(`/api/auth/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(json),
  signup: (email, password, name) =>
    apiFetch(`/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) }).then(json),

  chats: () => apiFetch(`/api/chats`).then(json),
  createChat: () => apiFetch(`/api/chats`, { method: "POST" }).then(json),
  chat: (id) => apiFetch(`/api/chats/${id}`).then(json),
  renameChat: (id, title) =>
    apiFetch(`/api/chats/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).then(json),
  deleteChat: (id) => apiFetch(`/api/chats/${id}`, { method: "DELETE" }).then(json),

  messages: (id) => apiFetch(`/api/chats/${id}/messages`).then(json),
  sendMessage: (id, content) =>
    apiFetch(`/api/chats/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).then(json),
  triggerStream: (id) => apiFetch(`/api/chats/${id}/stream`, { method: "POST" }).catch(() => {}),

  projects: () => apiFetch(`/api/projects`).then(json),
  stats: () => apiFetch(`/api/me/stats`).then(json),

  guestChat: (message, history) =>
    apiFetch(`/api/guest/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) }).then(json),

  // ── Admin console (server-side role checks — the app only hides, never protects) ──
  adminStats: () => apiFetch(`/api/admin/stats`).then(json),
  adminHealth: () => apiFetch(`/api/admin/health`).then(json),
  adminSeries: (days = 14) => apiFetch(`/api/admin/series?days=${days}`).then(json),
  adminUsers: (q = "", filter = "all", page = 1) =>
    apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}&pageSize=25`).then(json),
  adminPatchUser: (id, body) =>
    apiFetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json),
};
