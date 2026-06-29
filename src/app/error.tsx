"use client";

import { useEffect } from "react";
import styles from "./dashboard/dashboard.module.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Something went wrong!</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          {error.message || "An unexpected error occurred in the application."}
        </p>
        <button
          className="btn"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
