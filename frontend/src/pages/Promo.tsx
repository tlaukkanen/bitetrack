import React from 'react';

export default function Promo() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative overflow-hidden">
  <div className="max-w-4xl mx-auto px-4 pt-10 pb-8 md:pt-14 md:pb-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-700">BiteTrack</h1>
              <p className="mt-3 text-gray-700 text-base md:text-lg">
                Track meals effortlessly, see your macros at a glance, and stay on top of your goals. BiteTrack makes nutrition simple, beautiful, and fast.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition"
                >
                  Get Started
                </a>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-white text-emerald-700 font-semibold shadow-sm border border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 active:scale-[0.99] transition"
                >
                  Learn more
                </a>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                <img
                  src="/photos/mobile_meal_summary-portrait.png"
                  alt="BiteTrack daily summary mockup"
                  className="w-60"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <img
                  src="/photos/mobile_meal_details-portrait.png"
                  alt="BiteTrack meal details mockup"
                  className="  absolute -right-1 top-10 w-48 md:w-48 lg:w-48 rotate-6"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-white">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Why BiteTrack?</h2>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Feature title="AI-Powered Meal Analysis" desc="Snap a photo and let BiteTrack extract calories and macros automatically."/>
            <Feature title="Macro Goals" desc="Set your daily targets and track progress in real time."/>
            <Feature title="Fast & Mobile-First" desc="Optimized for speed and clarity on phones, tablets, and desktops."/>
            <Feature title="Simple Editing" desc="Adjust descriptions, macros, or timestamps with one tap."/>
            <Feature title="Privacy First" desc="Your data lives with you. Export or delete any time."/>
            <Feature title="Delightful UI" desc="Clean, accessible design that stays out of your way."/>
          </div>
          <div className="mt-8">
            <a
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition"
            >
              Create your account - Sorry, invite only for now 😉
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-sm text-gray-600 flex items-center justify-center gap-2 flex-wrap">
            <span>Created in</span>
            <img src="/eu-flag.svg" alt="EU" className="h-4 w-auto align-middle" />
            <span>with</span>
            <img src="/heart.svg" alt="heart" className="h-4 w-auto align-middle" />
            <span>by</span>
            <a href="https://www.linkedin.com/in/tlaukkanen/" className="text-emerald-700 font-medium hover:underline" target="_blank" rel="noopener noreferrer">Tommi Laukkanen</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-5 rounded-lg border bg-gray-50">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-700">{desc}</p>
    </div>
  );
}
