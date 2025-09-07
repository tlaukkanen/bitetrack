import React from 'react';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-8 md:pt-14 md:pb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-700">Pricing</h1>
          <p className="mt-3 text-gray-700 text-base md:text-lg">
            BiteTrack is currently invite-only while we polish the experience. Public pricing will be announced soon.
          </p>
          <div className="mt-6">
            <a href="/login" className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition">
              Request access
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
          <div className="grid sm:grid-cols-2 gap-6">
            <Card title="Free (Beta)" desc="Invite-only preview while we finalize features." />
            <Card title="Pro" desc="Post-launch plan for power users. Pricing TBD." />
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-5 rounded-lg border bg-gray-50">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-700">{desc}</p>
    </div>
  );
}
