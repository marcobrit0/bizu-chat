/**
 * Build a per-user namespaced blob key. Prevents one user's upload from
 * overwriting another's when filenames collide (e.g. "foto.png").
 */
export function buildBlobKey(userId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${userId}/${sanitized || "upload"}`;
}
