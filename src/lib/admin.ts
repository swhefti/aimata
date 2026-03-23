/**
 * Admin access control.
 * Defines which users have admin/ops access.
 */

const ADMIN_EMAILS = [
  'shefti@gmail.com',
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
