// src/lib/transactionView.js
// Normalized presentation model for `transactions` rows.
//
// The real data lives in `transactions` (id, user_id, type, category, amount,
// balance_before, balance_after, status, reference, description, metadata,
// created_at). This module derives a clean, receipt-friendly view from a raw
// row without duplicating the data anywhere.
//
// Metadata shapes actually stored today:
//   airtime_purchase: { network, phone_number, face_value, selling_price,
//                       user_discount, admin_discount, provider_ident,
//                       provider_transaction_id, provider_response:{...} }
//   data:             { plan_name, plan_network, duration, mobile_number,
//                       plan_amount, api_response, ident, id, Status }
//   wallet_funding / wallet_debit: metadata = {} (description carries context)

import {
  Wifi,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";

export function formatNaira(amount) {
  const value = Number(amount) || 0;
  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

// "Today, 8:32 AM" / "Yesterday, 8:32 AM" / "15 Aug 2026, 8:32 AM"
export function smartDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const ts = d.getTime();
  const time = d.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (ts >= startOfToday) return `Today, ${time}`;
  if (ts >= startOfToday - 86400000) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export const CATEGORY_META = {
  data: {
    label: "Data",
    icon: Wifi,
    theme: "bg-indigo-100 text-indigo-600",
  },
  airtime_purchase: {
    label: "Airtime",
    icon: Phone,
    theme: "bg-fuchsia-100 text-fuchsia-600",
  },
  wallet_funding: {
    label: "Funding",
    icon: ArrowDownLeft,
    theme: "bg-emerald-100 text-emerald-600",
  },
  wallet_debit: {
    label: "Wallet",
    icon: ArrowUpRight,
    theme: "bg-amber-100 text-amber-600",
  },
};

export const DEFAULT_CATEGORY_META = {
  label: "Transaction",
  icon: Wallet,
  theme: "bg-slate-100 text-slate-600",
};

export const CATEGORY_ORDER = [
  "airtime_purchase",
  "data",
  "wallet_funding",
  "wallet_debit",
];

export const STATUS_META = {
  successful: {
    label: "Successful",
    badge: "bg-emerald-100 text-emerald-700",
  },
  completed: {
    label: "Successful",
    badge: "bg-emerald-100 text-emerald-700",
  },
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
  failed: { label: "Failed", badge: "bg-red-100 text-red-600" },
};

export function isSuccessStatus(status) {
  return status === "successful" || status === "completed";
}

export function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label: status || "Pending",
      badge: "bg-slate-100 text-slate-600",
    }
  );
}

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}

export function sanitizeSearchTerm(raw) {
  // Strip characters that have special meaning to PostgREST's or()/ilike so
  // a raw user search string can never break or widen the query.
  return (raw || "").replace(/[%_*,()"\\]/g, "").trim();
}

// Builds the receipt-friendly view used by the dashboard, history page and
// the transaction detail modal.
export function buildTransactionView(tx) {
  if (!tx) return null;

  const category = tx.category || "other";
  const meta = getCategoryMeta(category);
  const m = tx.metadata || {};
  const status = tx.status || "pending";
  const statusMeta = getStatusMeta(status);
  const credit = tx.type === "credit";

  let title;
  let subtitle;
  let network = null;
  let phone = null;
  let plan = null;
  let providerRef = null;
  let providerResponse = null;
  let faceValue = null;

  if (category === "airtime_purchase") {
    network = m.network || null;
    phone = m.phone_number || null;
    faceValue = m.face_value ?? null;
    providerRef =
      m.provider_transaction_id ??
      m.provider_ident ??
      m.provider_response?.id ??
      null;
    providerResponse =
      m.provider_response?.api_response || m.provider_response?.Status || null;
    title = network ? `${network} Airtime` : "Airtime";
    const bits = [];
    if (phone) bits.push(phone);
    if (faceValue != null) bits.push(formatNaira(faceValue));
    subtitle = bits.join(" • ") || tx.description || "";
  } else if (category === "data") {
    network = m.plan_network || null;
    plan = m.plan_name || null;
    phone = m.mobile_number || null;
    providerRef = m.ident || m.id || null;
    providerResponse = m.api_response || m.Status || null;
    title = network ? `${network} Data` : "Data";
    const bits = [];
    if (plan) bits.push(plan);
    if (m.duration) bits.push(m.duration);
    if (phone) bits.push(phone);
    subtitle = bits.join(" • ") || tx.description || "";
  } else if (category === "wallet_funding") {
    title = "Wallet Funding";
    subtitle = tx.description || "Wallet top up";
  } else if (category === "wallet_debit") {
    title = "Wallet Adjustment";
    subtitle = tx.description || "Wallet debit";
  } else {
    title = meta.label;
    subtitle = tx.description || "";
  }

  return {
    id: tx.id,
    category,
    categoryLabel: meta.label,
    icon: meta.icon,
    iconTheme: meta.theme,
    status,
    statusLabel: statusMeta.label,
    statusBadge: statusMeta.badge,
    success: isSuccessStatus(status),
    credit,
    type: tx.type,
    amount: Number(tx.amount) || 0,
    amountLabel: (credit ? "+" : "-") + formatNaira(tx.amount),
    amountColor: credit ? "text-emerald-600" : "text-slate-800",
    reference: tx.reference,
    description: tx.description,
    date: tx.created_at,
    dateLabel: formatDateTime(tx.created_at),
    smartDateLabel: smartDate(tx.created_at),
    balanceBefore: tx.balance_before,
    balanceAfter: tx.balance_after,
    title,
    subtitle,
    network,
    phone,
    plan,
    faceValue,
    providerRef,
    providerResponse,
    metadata: m,
    raw: tx,
  };
}