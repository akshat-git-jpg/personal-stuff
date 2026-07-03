// Inter loaded as Apple SF Pro substitute. We use refined weights only —
// no italics, no extended/condensed widths.

import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
