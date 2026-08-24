import { Composition, registerRoot } from "remotion";
import { CvCIntro } from "./CvCIntro";

// Minimal entry: register ONLY CvCIntro so the bundle loads just this comp's
// fonts (Space Grotesk / JetBrains Mono) — keeps headless font loading under the
// 5s delayRender window instead of pulling every comp's loadFont() via Root.
const CvCRoot: React.FC = () => (
  <Composition
    id="CvCIntro"
    component={CvCIntro}
    durationInFrames={614}
    fps={25}
    width={1920}
    height={1080}
  />
);

registerRoot(CvCRoot);
