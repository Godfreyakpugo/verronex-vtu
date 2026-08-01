const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function UserRow({ user }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-800">{user.full_name}</div>
        <div className="text-xs text-slate-500">{user.email}</div>
      </td>
      <td className="px-4 py-3 text-slate-600">{user.phone}</td>
      <td className="px-4 py-3 font-semibold text-slate-800">
        ₦{formatMoney(user.wallet_balance)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            user.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {user.status}
        </span>
      </td>
    </tr>
  );
}
