"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        Try again
      </button>
    </main>
  );
}
