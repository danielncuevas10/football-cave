import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#242424] border-t border-[#313131] px-6 py-6 mt-auto">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} FootballCave. All rights reserved.</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-300 transition-colors">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
