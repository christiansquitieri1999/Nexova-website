"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  authHeaders,
  authFetch,
  logout,
  type CurrentUserResponse,
} from "@/lib/auth";

interface ProfileForm {
  name: string;
  phone: string;
  address: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [form, setForm] = useState<ProfileForm>({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load user data
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u) {
          router.replace("/login");
          return;
        }
        setUser(u);
        setForm({
          name: u.profile?.name ?? "",
          phone: u.profile?.phone ?? "",
          address: u.profile?.address ?? "",
        });
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSuccess("");
      setSaving(true);

      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://127.0.0.1:8002"}/profiles/me`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify(form),
          },
        );

        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const msg =
            body && typeof body === "object" && "detail" in body
              ? String((body as Record<string, unknown>).detail)
              : "Could not update profile.";
          throw new Error(msg);
        }

        setSuccess("Profile updated successfully.");
        // Refresh user data
        const refreshed = await getCurrentUser();
        if (refreshed) setUser(refreshed);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      } finally {
        setSaving(false);
      }
    },
    [form],
  );

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/login");
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return null; // will redirect
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Profile</h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {user.role}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
            htmlFor="email"
            className="block text-sm font-medium text-gray-900"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Email cannot be changed.
          </p>
        </div>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-900"
          >
            Display name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Your display name"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-900"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="+1 555 123 4567"
          />
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-900"
          >
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="123 Main St"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Log out
          </button>

          <Link
            href="/account/change-password"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Change password
          </Link>
        </div>
      </form>
    </div>
  );
}