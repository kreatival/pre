export type SubscriptionStatusValue = "ACTIVE" | "TRIAL" | "PAUSED" | "CANCELLED";

export function normalizeSubscriptionStatus(status?: string | null): SubscriptionStatusValue {
  const value = (status ?? "ACTIVE").toUpperCase();
  if (value === "TRIAL" || value === "PAUSED" || value === "CANCELLED") return value;
  return "ACTIVE";
}

export function isSubscriptionActive(status?: string | null, endsAt?: Date | string | null): boolean {
  const normalized = normalizeSubscriptionStatus(status);

  if (normalized === "PAUSED" || normalized === "CANCELLED") return false;
  if (!endsAt) return true;

  const expiresAt = new Date(endsAt).getTime();
  if (Number.isNaN(expiresAt)) return true;

  return expiresAt > Date.now();
}
