"use client";

import { useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";

/**
 * Signals to the Mini App host that the app is ready, which dismisses the
 * launch splash. Safe no-op outside a Mini App host. Renders nothing.
 */
export function FrameReady() {
  const { setMiniAppReady, isMiniAppReady } = useMiniKit();

  useEffect(() => {
    if (!isMiniAppReady) {
      setMiniAppReady();
    }
  }, [isMiniAppReady, setMiniAppReady]);

  return null;
}
