export function structureRoleLabel(role: string) {
  if (role === "hook") return "훅";
  if (role === "body") return "반복 본문";
  if (role === "cta") return "CTA";
  return role;
}
