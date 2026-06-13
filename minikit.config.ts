// Helper for `npx create-onchain --manifest` ONLY.
//
// The running app does NOT read this file — the manifest is served from
// app/.well-known/farcaster.json (built from lib/miniapp + FARCASTER_* env vars).
// The signing tool fills in header/payload/signature below. After signing, those
// three values get copied into Vercel env FARCASTER_HEADER / FARCASTER_PAYLOAD /
// FARCASTER_SIGNATURE (which the route reads) and the app is redeployed.
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE4ODA2MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDFENTgzMjgyMDU0MjlEMzljRTIxYTEzRGNEM0ZlQjczMTgwQzlCMjAifQ",
    payload: "eyJkb21haW4iOiJlbmdlbGF0LnZlcmNlbC5hcHAifQ",
    signature: "MHhjODgxNWIyMzE3NDdmNWY1ZGU2MjI0ZWMxNGQ3ZmZhYTJkZTQ2ZjBhNzdhMzdhMDc3N2IzNDNlOWUxYmViZWRjMjM2ZDMxNzYzODg3ZjUxNmI5N2Q5OThiNTkwZGRkNjQ1NDlmY2Y0NmFlNmVkMjcxYTg5Nzg0OTE5MTI4MjMyNTFi",
  },
  miniapp: {
    version: "1",
    name: "Engelat",
    homeUrl: "https://engelat.vercel.app",
  },
};
