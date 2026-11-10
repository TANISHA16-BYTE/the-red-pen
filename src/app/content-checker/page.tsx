import Link from "next/link";
import ContentCheckerPanel from "../content-checker-panel";

export default function ContentCheckerPage() {
  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e1d8] pb-5">
          <Link href="/" className="text-sm font-semibold text-[#a34e42] hover:underline">
            ← Back to Company Brain
          </Link>
          <span className="text-lg font-bold tracking-tight text-[#292522]">
            the red pen<span className="text-[#a34e42]">.</span>
          </span>
        </header>
        <ContentCheckerPanel />
      </div>
    </main>
  );
}
