// Brand-aligned presentation styles for VTU networks, shared by the public
// marketing pages so each network reads distinctly at a glance.
export const NETWORK_STYLES = {
  MTN: {
    // Yellow fading into a dark, blackish yellow
    header:
      "bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 text-slate-900",
    dot: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  },
  AIRTEL: {
    header: "bg-gradient-to-r from-red-500 to-red-700 text-white",
    dot: "bg-gradient-to-br from-red-500 to-red-700",
  },
  GLO: {
    header: "bg-gradient-to-r from-green-500 to-green-700 text-white",
    dot: "bg-gradient-to-br from-green-500 to-green-700",
  },
  "9MOBILE": {
    // Emerald fading into teal — clearly distinct from Glo's pure green
    header:
      "bg-gradient-to-r from-emerald-300 via-emerald-500 to-teal-700 text-slate-900",
    dot: "bg-gradient-to-br from-emerald-400 to-teal-600",
  },
};

const FALLBACK = {
  header: "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-700",
  dot: "bg-slate-400",
};

export function getNetworkStyle(network) {
  const key = Object.keys(NETWORK_STYLES).find(
    (k) => (network || "").toUpperCase().includes(k),
  );
  return key ? NETWORK_STYLES[key] : FALLBACK;
}