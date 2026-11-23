"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, logout, type CurrentUserResponse } from "@/lib/auth";

/**
 * Top navigation bar for the backoffice.
 *
 * Shows the app title, page links, and user session controls.
 * Must be used inside an AuthGuard (client component tree).
 */
export default function NavBar() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/login");
  }, [router]);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Brand + nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gray-900"
          >
            Nexova
          </Link>
          <nav className="hidden sm:flex sm:gap-4">
            <Link
              href="/suppliers"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Suppliers
            </Link>
            <Link
              href="/incidents"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Incidents
            </Link>
            <Link
              href="/candidates"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Candidates
            </Link>
          </nav>
        </div>

        {/* Right: User info + logout */}
        <div className="flex items-center gap-4">
          {user && (
            <span className="hidden text-sm text-gray-500 sm:inline">
              {user.profile?.name || user.email}
              <span className="ml-1 text-xs text-gray-400">
                ({user.role})
              </span>
            </span>
          )}

          <button
            onClick={handleLogout}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Log out
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
            aria-label="Open menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="border-t border-gray-200 px-4 py-3 sm:hidden">
          {user && (
            <p className="mb-2 text-sm text-gray-500">
              {user.profile?.name || user.email}
            </p>
          )}
          <nav className="flex flex-col gap-2">
            <Link
              href="/suppliers"
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              Suppliers
            </Link>
            <Link
              href="/incidents"
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              Incidents
            </Link>
            <Link
              href="/candidates"
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              Candidates
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}