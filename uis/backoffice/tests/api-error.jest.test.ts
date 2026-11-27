import { fetchSafely, readJsonSafely } from "../lib/api-error";

describe("safe API response helpers", () => {
  test("returns successful fetch responses", async () => {
    const response = new Response("ok", { status: 200 });
    globalThis.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      fetchSafely("https://example.com", undefined, "Network unavailable"),
    ).resolves.toBe(response);
  });

  test("maps network failures to the caller fallback", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    await expect(
      fetchSafely("https://example.com", undefined, "Network unavailable"),
    ).rejects.toThrow("Network unavailable");
  });

  test("returns parsed JSON values", async () => {
    const response = new Response(JSON.stringify({ value: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(
      readJsonSafely(response, "Invalid JSON"),
    ).resolves.toEqual({ value: 1 });
  });

  test("maps malformed JSON to the caller fallback", async () => {
    const response = new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

    await expect(
      readJsonSafely(response, "Invalid JSON"),
    ).rejects.toThrow("Invalid JSON");
  });
});
