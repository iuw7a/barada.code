"use client";

import { useEffect, useState } from "react";
import { Globe, Copy, Check, RefreshCw, Link2, XCircle, Loader2 } from "lucide-react";

type Deployment = {
  subdomain: string;
  status: string;
  customDomain: string | null;
  domainVerifiedAt: string | null;
  lastDeployedAt: string;
};

export default function PublishPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [cnameTarget, setCnameTarget] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects/${projectId}/publish`)
      .then((r) => r.json())
      .then((d) => {
        if (d.deployment) {
          setDeployment(d.deployment);
          setUrl(d.url ?? null);
          setCnameTarget(d.cnameTarget ?? null);
          setSubdomain(d.deployment.subdomain);
          setCustomDomain(d.deployment.customDomain ?? "");
        }
      })
      .catch(() => {});
  }, [open, projectId]);

  async function call(method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.deployment) {
        setDeployment(data.deployment);
        setSubdomain(data.deployment.subdomain);
        if (data.url) setUrl(data.url);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setDeployment(data.deployment);
      setNotice("Domain verified ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function attachDomain() {
    if (!customDomain.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: customDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDeployment(data.deployment);
      setCnameTarget(data.cnameTarget ?? null);
      setNotice("Domain saved — add the CNAME record, then verify.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs" title="Publish">
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{deployment?.status === "LIVE" ? "Published" : "Publish"}</span>
      </button>

      {open && (
        <div className="card absolute end-0 top-full z-50 mt-2 w-80 p-4 text-start shadow-xl">
          {!deployment ? (
            <>
              <p className="mb-3 text-sm font-medium">Publish to the web</p>
              <div className="flex items-center gap-1 text-sm">
                <input
                  className="input flex-1"
                  placeholder="coffee-shop"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  maxLength={63}
                />
                <span className="shrink-0 text-xs text-ink-400">.iuw7a.com</span>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <button
                onClick={() => call("POST", { subdomain })}
                disabled={busy || subdomain.length < 3}
                className="btn-primary mt-3 w-full text-xs"
              >
                {busy ? "Publishing…" : "Publish"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Globe className="h-4 w-4 text-accent-600" />
                  {deployment.status === "LIVE" ? "Published" : "Offline"}
                </p>
                {deployment.status === "LIVE" && url && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="btn-ghost text-[11px]"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy URL"}
                  </button>
                )}
              </div>
              <p className="break-all rounded-lg bg-ink-100 px-2 py-1.5 text-xs dark:bg-ink-800">
                {url ?? `${deployment.subdomain}.iuw7a.com`}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">
                Last deployed {new Date(deployment.lastDeployedAt).toLocaleString()}
              </p>

              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              {notice && <p className="mt-2 text-xs text-accent-600">{notice}</p>}

              <div className="mt-3 flex gap-2">
                <button onClick={() => call("POST", { subdomain: deployment.subdomain })} disabled={busy} className="btn-ghost flex-1 text-xs">
                  <RefreshCw className="h-3 w-3" /> Redeploy
                </button>
                <button onClick={() => call("DELETE")} disabled={busy} className="btn-ghost flex-1 text-xs text-red-500">
                  <XCircle className="h-3 w-3" /> Unpublish
                </button>
              </div>

              {/* Custom domain */}
              <div className="mt-4 border-t border-ink-200 pt-3 dark:border-ink-700">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <Link2 className="h-3 w-3" /> Custom domain
                </p>
                {deployment.customDomain ? (
                  <div className="text-xs">
                    <p className="flex items-center gap-1.5">
                      {deployment.domainVerifiedAt ? (
                        <><Check className="h-3 w-3 text-accent-600" /> {deployment.customDomain} — verified</>
                      ) : (
                        <><Loader2 className="h-3 w-3 animate-spin" /> {deployment.customDomain} — unverified</>
                      )}
                    </p>
                    {!deployment.domainVerifiedAt && cnameTarget && (
                      <p className="mt-1 text-ink-400">
                        CNAME {deployment.customDomain} → <span className="font-mono">{cnameTarget}</span>
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      {!deployment.domainVerifiedAt && (
                        <button onClick={verifyDomain} disabled={busy} className="btn-ghost text-[11px]">Verify DNS</button>
                      )}
                      <button
                        onClick={async () => {
                          await fetch(`/api/projects/${projectId}/domains`, { method: "DELETE" });
                          setDeployment((d) => (d ? { ...d, customDomain: null, domainVerifiedAt: null } : d));
                        }}
                        className="btn-ghost text-[11px] text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      className="input flex-1 text-xs"
                      placeholder="coffeeshop.com"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                    />
                    <button
                      onClick={attachDomain}
                      disabled={busy || customDomain.length < 4}
                      className="btn-primary shrink-0 text-xs"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
