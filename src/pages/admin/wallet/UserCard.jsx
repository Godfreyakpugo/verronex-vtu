const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function UserCard({ targetUser, targetWallet, walletLoading }) {
  if (!targetUser) return null;

  return (
    <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-slate-800">
            {targetUser.full_name}
          </p>
          <p className="text-sm text-slate-500">
            @{targetUser.username || "no-username"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Wallet Balance
          </p>
          <p className="text-xl font-black text-fuchsia-600">
            {walletLoading ? (
              <span className="text-sm text-slate-500">Loading balance...</span>
            ) : (
              `₦${formatMoney(targetWallet?.balance || 0)}`
            )}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-semibold text-slate-700">Email</span>
          <p className="text-slate-500 break-all">{targetUser.email}</p>
        </div>

        <div>
          <span className="font-semibold text-slate-700">Phone</span>
          <p className="text-slate-500">{targetUser.phone || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export default UserCard;
