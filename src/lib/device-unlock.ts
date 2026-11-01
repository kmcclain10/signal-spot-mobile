// Per-device Face ID / Touch ID unlock using the phone's built-in passkey (WebAuthn platform authenticator).
// This is a local unlock gate for the background lock only; it is not a sign-in method and
// sensitive actions still require password confirmation.
const KEY = "pulse-device-unlock";

type Stored = { userId: string; credentialId: string };

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function readUnlock(userId: string | undefined): Stored | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    return v && v.userId === userId && v.credentialId ? v : null;
  } catch { return null; }
}

export async function deviceUnlockSupported() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

export async function enrollDeviceUnlock(userId: string, email: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Pulse Signals", id: window.location.hostname },
      user: { id: new TextEncoder().encode(userId), name: email || "Pulse Signals", displayName: email || "Pulse Signals" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID setup was cancelled.");
  localStorage.setItem(KEY, JSON.stringify({ userId, credentialId: toB64(cred.rawId) }));
}

export async function verifyDeviceUnlock(stored: Stored) {
  const r = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      allowCredentials: [{ type: "public-key", id: fromB64(stored.credentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!r;
}

export function clearDeviceUnlock() { if (typeof window !== "undefined") localStorage.removeItem(KEY); }
