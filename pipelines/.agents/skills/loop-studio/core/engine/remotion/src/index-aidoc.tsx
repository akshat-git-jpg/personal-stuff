import { Composition, registerRoot } from "remotion";
import { AiDocScene } from "./AiDocScene";

// Minimal entry: register ONLY AiDocScene so the bundle loads just the three
// fonts this scene needs (Space Grotesk / JetBrains Mono / Playfair) instead of
// every comp's loadFont() — keeps headless font loading under the 5s delayRender
// window when rendering under software GL (swangle).
const AiDocRoot: React.FC = () => (
  <Composition
    id="AiDocScene"
    component={AiDocScene}
    durationInFrames={700}
    fps={25}
    width={1920}
    height={1080}
  />
);

registerRoot(AiDocRoot);
