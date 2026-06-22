// src/App.jsx — Updated smoke test with error display + input fields
import { useState } from "react";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, profile, wallet, loading, signIn, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Initializing...
      </div>
    );

  return (
    <div className="p-6 font-mono text-sm max-w-md">
      <h1 className="text-xl font-bold mb-4">Verronex VTU — Auth Test</h1>

      {user ? (
        <div className="space-y-2">
          <p>
            ✅ Logged in as: <strong>{user.email}</strong>
          </p>
          <p>
            Profile tier: <strong>{profile?.user_tier ?? "..."}</strong>
          </p>
          <p>
            Wallet balance: <strong>₦{wallet?.balance ?? "0.00"}</strong>
          </p>
          <button
            onClick={signOut}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="mb-2">❌ Not logged in</p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />

          {error && <p className="text-red-500 text-xs">⚠️ {error}</p>}

          <button
            onClick={handleSignIn}
            disabled={busy}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {busy ? "Signing in..." : "Test Sign In"}
          </button>
        </div>
      )}
    </div>
  );
}
