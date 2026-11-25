"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { resetPassword } from "@/lib/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError("");

      if (!token) {
        setError("This reset link is invalid or missing a reset token.");
        return;
      }
      if (newPassword.length < 6) {
        setError("Your new password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmation) {
        setError("New password and confirmation must match.");
        return;
      }

      setLoading(true);
      try {
        await resetPassword({ token, new_password: newPassword });
        router.replace("/login?passwordReset=success");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "This reset link is invalid or has expired.",
        );
      } finally {
        setLoading(false);
      }
    },
    [confirmation, newPassword, router, token],
  );

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h1 className="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">
          Reset your password
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {!token && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              <p>This reset link is invalid or missing a reset token.</p>
              <Link
                href="/forgot-password"
                className="mt-2 inline-block font-semibold text-red-800 underline"
              >
                Request a new reset link
              </Link>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              <Link
                href="/forgot-password"
                className="mt-2 inline-block font-semibold text-red-800 underline"
              >
                Request a new reset link
              </Link>
            </div>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-900"
            >
              New password
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              disabled={loading}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-gray-900"
            >
              Confirm new password
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmation}
              disabled={loading}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Updating..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
