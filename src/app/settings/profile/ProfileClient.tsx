"use client";

import { useState } from "react";
import { User } from "lucide-react";

export default function ProfileClient({
  name: initialName,
  email,
  avatarUrl: initialAvatar,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatarUrl: avatarUrl.trim() || null }),
    });
    if (res.ok) setSaved(true);
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Save failed");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    if (res.ok) {
      setPwMsg("Password changed.");
      setCurPw("");
      setNewPw("");
    } else {
      const d = await res.json().catch(() => ({}));
      setPwErr(d.error ?? "Password change failed");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-ink-500" />
            )}
          </div>
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-sm text-ink-500">{email}</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="flex max-w-md flex-col gap-3">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <input className="input" placeholder="Avatar URL (optional)" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">Save</button>
            {saved && <span className="text-xs text-accent-600">Saved</span>}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="flex max-w-md flex-col gap-3">
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="input"
            type="password"
            placeholder="New password (8+ characters)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
          {pwErr && <p className="text-sm text-red-600 dark:text-red-400">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-accent-600">{pwMsg}</p>}
          <button type="submit" className="btn-primary">Update password</button>
        </form>
      </section>
    </div>
  );
}
