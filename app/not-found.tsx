import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">

      <div className="text-center">

        <p className="text-sm font-semibold text-blue-600">
          FRONTIER
        </p>

        <h1 className="mt-4 text-5xl font-bold">
          Incident not found
        </h1>

        <p className="mt-4 text-gray-500">
          The incident you're looking for doesn't exist.
        </p>

        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800"
        >
          Back to Frontier
        </Link>

      </div>

    </main>
  );
}