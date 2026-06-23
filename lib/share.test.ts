import { describe, it, expect } from "vitest";
import {
  buildShareText,
  buildPlayUrl,
  buildOgUrl,
  buildWarpcastIntentUrl,
} from "./share";

describe("share", () => {
  it("share text mentions the coin and score", () => {
    const text = buildShareText("BTC", 42);
    expect(text).toContain("BTC");
    expect(text).toContain("42");
  });

  it("play url carries coin + score and tolerates a trailing slash on base", () => {
    expect(buildPlayUrl("https://engelat.vercel.app", "ETH", 7)).toBe(
      "https://engelat.vercel.app/?coin=ETH&score=7"
    );
    expect(buildPlayUrl("https://engelat.vercel.app/", "ETH", 7)).toBe(
      "https://engelat.vercel.app/?coin=ETH&score=7"
    );
  });

  it("og url points at the dynamic image route", () => {
    expect(buildOgUrl("https://engelat.vercel.app", "SOL", 13)).toBe(
      "https://engelat.vercel.app/api/og?coin=SOL&score=13"
    );
  });

  it("warpcast intent encodes text and the embed url", () => {
    const url = buildWarpcastIntentUrl("hello world", "https://x.test/og?coin=BTC&score=1");
    expect(url.startsWith("https://farcaster.xyz/~/compose?")).toBe(true);
    expect(url).toContain("text=hello+world");
    expect(url).toContain("embeds[]=https%3A%2F%2Fx.test%2Fog%3Fcoin%3DBTC%26score%3D1");
  });
});
