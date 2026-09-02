"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send message");
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not send message");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-accent-600" />
        <p className="font-medium">Message sent</p>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Thanks — we&apos;ll get back to you at {form.email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Name</span>
          <input required value={form.name} onChange={update("name")} className="input w-full" placeholder="Your name" maxLength={100} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Email</span>
          <input required type="email" value={form.email} onChange={update("email")} className="input w-full" placeholder="you@example.com" maxLength={200} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Subject</span>
        <input required value={form.subject} onChange={update("subject")} className="input w-full" placeholder="What's it about?" maxLength={150} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Message</span>
        <textarea required value={form.message} onChange={update("message")} rows={6} className="input w-full resize-y" placeholder="Tell us everything (min 10 characters)…" maxLength={5000} />
      </label>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending" || form.message.trim().length < 10} className="btn-primary flex items-center gap-2">
        {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
