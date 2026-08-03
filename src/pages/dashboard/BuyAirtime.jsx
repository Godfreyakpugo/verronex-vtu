import { useState } from "react";
import { airtimeAPI } from "../../lib/wazobiaApi";

const NETWORKS = [
  { id: 1, name: "MTN" },
  { id: 2, name: "GLO" },
  { id: 3, name: "9MOBILE" },
  { id: 4, name: "AIRTEL" },
];

const TYPES = ["VTU", "Bundle", "ShareNsell", "Awuf"];

export default function BuyAirtime() {
  const [network, setNetwork] = useState(1);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("VTU");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const result = await airtimeAPI.purchase({
        network_id: Number(network),
        amount: Number(amount),
        airtime_type: type,
        phone_number: phone,
      });

      setMessage(
        `✅ Airtime purchase successful.\nReference: ${result.transaction_id}`,
      );
    } catch (err) {
      setMessage(err.message);
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
            <option key={n.id} value={n.id}>
              {n.name}
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border rounded p-3"
        >
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

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
