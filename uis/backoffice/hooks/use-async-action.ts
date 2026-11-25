"use client";

import { useState } from "react";

export default function useAsyncAction<TResult>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function run(
    action: () => Promise<TResult>,
    successMessage: string,
  ): Promise<TResult | null> {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await action();
      setSuccess(successMessage);
      return result;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The request could not be completed. Please try again.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearSuccess() {
    setSuccess("");
  }

  return { loading, error, success, run, clearSuccess };
}
