import { useState } from "react";
import supabase from "../../lib/supabaseClient";

const NETWORKS = ["MTN", "GLO", "AIRTEL", "9MOBILE"];

async function extractFunctionErrorMessage(error) {
  // supabase-js v2: FunctionsHttpError carries the real message in
  // error.context (a Response) when the edge function returns non-2xx.
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch (_jsonErr) {
      // context wasn't JSON (or already consumed) — fall through
    }
  }
  return error?.message || "Something went wrong. Please try again.";
}

export default function BuyAirtime() {
  const [network, setNetwork] = useState("MTN");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "purchase-airtime",
        {
          body: {
            network,
            phoneNumber: phone,
            amount: Number(amount),
          },
        },
      );

      if (error) {
        setMessage(await extractFunctionErrorMessage(error));
        return;
      }

      if (data?.error) {
        setMessage(data.error);
        return;
      }

      if (data?.success) {
        setMessage(
          `✅ ${data.message || "Airtime purchase successful"}.\nReference: ${data.reference}`,
        );
        return;
      }

      if (data?.pending) {
        setMessage(`⏳ ${data.message}`);
        return;
      }

      setMessage("Something went wrong. Please try again.");
    } catch (err) {
      setMessage(await extractFunctionErrorMessage(err));
    }

    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Buy Airtime</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          className="w-full border rounded p-3"
        >
          {NETWORKS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <input
          className="w-full border rounded p-3"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className="w-full border rounded p-3"
          placeholder="Amount"
          type="number"
          min="50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          disabled={loading}
          className="w-full bg-indigo-600 text-white rounded p-3"
        >
          {loading ? "Processing..." : "Buy Airtime"}
        </button>
      </form>

      {message && <div className="mt-6 whitespace-pre-wrap">{message}</div>}
    </div>
  );
}