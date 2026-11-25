"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { changePassword } from "@/lib/auth";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError("");
      setSuccess("");

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
        await changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        setSuccess("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not change the password.",
        );
      } finally {
        setLoading(false);
      }
    },
    [confirmation, currentPassword, newPassword],
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Change password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update the password for your Nexova account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-gray-900"
          >
            Current password
          </label>
          <input
            id="current-password"
            name="current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            disabled={loading}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          />
        </div>

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

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Changing..." : "Change password"}
          </button>
          <Link
            href="/account/profile"
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Back to profile
          </Link>
        </div>
      </form>
    </div>
  );
}
