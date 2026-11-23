"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

/** Paths that are accessible without authentication. */
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * AuthGuard — a client component that:
 * - Redirects unauthenticated users to /login (unless already on /login or /register).
 * - Redirects authenticated users away from /login and /register to /.
 *
 * Wrap the main layout's children with this component.
 * Do NOT use Next.js middleware — localStorage is not available server-side.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = getToken();
    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!token && !isPublic) {
      // Unauthenticated + protected path → redirect to /login
      const redirectParam =
        pathname !== "/login"
          ? `?redirect=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${redirectParam}`);
    } else if (token && isPublic) {
      // Already authenticated on login/register → go home
      router.replace("/");
    } else {
      // Everything is fine
      setAllowed(true);
    }
  }, [router, pathname]);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}