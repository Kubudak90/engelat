import { describe, it, expect } from "vitest";
import {
  MINIAPP,
  normalizeBase,
  assetUrls,
  buildEmbed,
  buildManifest,
} from "./miniapp";

describe("miniapp", () => {
  it("normalizeBase strips a trailing slash", () => {
    expect(normalizeBase("https://x.com/")).toBe("https://x.com");
    expect(normalizeBase("https://x.com")).toBe("https://x.com");
  });

  it("assetUrls builds absolute asset URLs from a base", () => {
    expect(assetUrls("https://x.com")).toEqual({
      icon: "https://x.com/icon.png",
      splash: "https://x.com/splash.png",
      hero: "https://x.com/hero.png",
      home: "https://x.com",
    });
  });

  it("buildEmbed produces a launch_miniapp embed", () => {
    const e = buildEmbed("https://x.com");
    expect(e.version).toBe("1");
    expect(e.imageUrl).toBe("https://x.com/hero.png");
    expect(e.button.title).toBe("Play Engelat");
    expect(e.button.action.type).toBe("launch_miniapp");
    expect(e.button.action.url).toBe("https://x.com");
    expect(e.button.action.splashImageUrl).toBe("https://x.com/splash.png");
    expect(e.button.action.splashBackgroundColor).toBe(MINIAPP.splashBackgroundColor);
  });

  it("buildManifest includes the miniapp object and omits accountAssociation when no assoc", () => {
    const m = buildManifest("https://x.com");
    expect(m.accountAssociation).toBeUndefined();
    expect(m.miniapp.name).toBe("Engelat");
    expect(m.miniapp.iconUrl).toBe("https://x.com/icon.png");
    expect(m.miniapp.homeUrl).toBe("https://x.com");
    expect(m.miniapp.primaryCategory).toBe("games");
    expect(m.miniapp.splashBackgroundColor).toBe(MINIAPP.splashBackgroundColor);
  });

  it("buildManifest includes accountAssociation when provided", () => {
    const assoc = { header: "h", payload: "p", signature: "s" };
    const m = buildManifest("https://x.com", assoc);
    expect(m.accountAssociation).toEqual(assoc);
  });
});
