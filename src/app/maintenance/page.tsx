export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center">
      <div>
        <img
          src="/barada-logo.png"
          alt="Barada Code"
          className="mx-auto h-20 w-20 rounded-3xl bg-emerald-500/10 object-contain p-2 ring-1 ring-emerald-500/30"
        />
        <h1 className="mt-6 text-2xl font-bold text-ink-100">We&apos;ll be right back</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-400">
          Barada Code is temporarily under maintenance. We&apos;re making things better — please check back in a little while.
        </p>
      </div>
    </main>
  );
}
