/** Blocks key-like input in the chat and search box before it leaves the browser. Deliberately over-eager. */
export const SECRET =
  /(sk-[A-Za-z0-9_\-]{12,}|ghp_[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9\-]{10,}|AIza[0-9A-Za-z_\-]{30,}|GOCSPX-[A-Za-z0-9_\-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|client[_ ]?secret\s*[:=]\s*\S{8,}|\b[A-Za-z0-9_\-]{40,}\b)/i;

export const looksLikeSecret = (s: string) => SECRET.test(s);
