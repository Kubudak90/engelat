import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { FrameReady } from "@/components/FrameReady";
import { baseUrl, assetUrls, buildEmbed, MINIAPP } from "@/lib/miniapp";

function safeUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function generateMetadata(): Metadata {
  const base = baseUrl();
  const a = assetUrls(base);
  return {
    metadataBase: safeUrl(base),
    title: MINIAPP.name,
    description: MINIAPP.description,
    openGraph: {
      title: MINIAPP.name,
      description: MINIAPP.description,
      images: [a.hero],
    },
    icons: { icon: a.icon },
    other: {
      "fc:miniapp": JSON.stringify(buildEmbed(base)),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <FrameReady />
          {children}
        </Providers>
      </body>
    </html>
  );
}
