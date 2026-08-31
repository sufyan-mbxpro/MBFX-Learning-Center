import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link href="/admin" className="text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
    </main>
  );
}
