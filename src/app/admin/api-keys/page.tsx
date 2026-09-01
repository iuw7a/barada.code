import { apiKeysStatus, getAdminOrRedirect } from "@/lib/admin";
import { Head } from "../components";
import { KeyRow } from "./KeyRow";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  await getAdminOrRedirect();
  const keys = apiKeysStatus();

  return (
    <div className="space-y-5">
      <Head title="API Keys" sub="Secrets never leave the server — only masked previews are shown here." />
      <div className="rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Provider", "Key (masked)", "Env variable", "Usage", "Status", "Test"].map((h) => (
                <th key={h} className="p-3.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => <KeyRow key={k.env} provider={k.provider} masked={k.key} env={k.env} usage={k.usage} ok={k.ok} />)}
          </tbody>
        </table>
      </div>
      <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] leading-5 text-zinc-500">
        Security model: all provider secrets live in server-side environment variables. The admin UI only receives a masked
        preview (first 5 / last 4 characters) and a boolean status. Adding, rotating and revoking provider keys is done by
        updating the environment and restarting the process — never through the browser — so a stolen admin session cannot
        read the raw secrets.
      </p>
    </div>
  );
}
