import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            YASS
          </h1>
          <p className="text-xl font-medium text-gray-600">
            Yet Another Simple Signup
          </p>
        </div>

        <div className="space-y-4 text-gray-600 max-w-lg mx-auto">
          <p className="text-lg">
            Fair event signups — no bots, no refresh wars, no repeat attendees
            hogging spots.
          </p>
          <p className="text-base text-gray-500">
            Sign up without creating an account. Verify your email. Get
            selected fairly. YASS uses lottery and preference-point algorithms
            so everyone gets a turn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-500 bg-white rounded-xl border p-6">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">🎟</span>
            <span className="font-medium text-gray-700">No account needed</span>
            <span>Just your email. Verify once and you&apos;re in the queue.</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <span className="font-medium text-gray-700">Transparent fairness</span>
            <span>Lottery, FCFS, or preference-weighted — you see how you got picked.</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📣</span>
            <span className="font-medium text-gray-700">Automatic notifications</span>
            <span>Email confirmations, waitlist updates, and cancellation handled for you.</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Browse Events
          </Link>
          <Link
            href="/organizer"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Organizer Login
          </Link>
        </div>
      </div>
    </main>
  );
}
