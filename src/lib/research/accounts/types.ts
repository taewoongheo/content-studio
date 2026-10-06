export const accountPlatforms = ["tiktok", "instagram"] as const;
export type AccountPlatform = typeof accountPlatforms[number];
export const accountActions = ["login", "finish", "cancel", "disconnect", "import_safari"] as const;
export type AccountAction = typeof accountActions[number];
export type AccountStatus = {
  platform: AccountPlatform;
  status: "disconnected" | "connected" | "login_required" | "logging_in";
  reason: "expired" | "rejected" | "missing" | "invalid" | null;
  expiresAt: string | null;
  updatedAt: string | null;
};
export const accountUrls: Record<AccountPlatform, string> = {
  tiktok: "https://www.tiktok.com/login", instagram: "https://www.instagram.com/accounts/login/",
};
