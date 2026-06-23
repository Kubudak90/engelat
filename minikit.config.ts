// Helper for `npx create-onchain --manifest` ONLY.
//
// The running app does NOT read this file — the manifest is served from
// app/.well-known/farcaster.json (built from lib/miniapp + FARCASTER_* env vars).
// The signing tool fills in header/payload/signature below. After signing, those
// three values get copied into Vercel env FARCASTER_HEADER / FARCASTER_PAYLOAD /
// FARCASTER_SIGNATURE (which the route reads) and the app is redeployed.
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE4ODA1MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweEY2MzI5NThmMThhNkU1NmZFNTYzNWM5NTRkMTY5MTFGZTQ3ODc4OTgifQ",
    payload: "eyJkb21haW4iOiJlbmdlbGF0LnZlcmNlbC5hcHAifQ",
    signature: "53UHykhxuoIs51Dq1qJ76UfMnHbJ/L7pzUgvL4NX6kMjLwHLCfrantlCLgP5onOKW/alUL9nR1KU0veDR4yM8Bw=",
  },
  miniapp: {
    version: "1",
    name: "Engelat",
    homeUrl: "https://engelat.vercel.app",
  },
};
