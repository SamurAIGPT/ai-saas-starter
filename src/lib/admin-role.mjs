export function isAdminEmail(email) {
  if (typeof email !== "string" || !email.trim()) return false;
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}
