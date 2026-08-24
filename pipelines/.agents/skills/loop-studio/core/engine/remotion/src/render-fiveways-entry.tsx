// Minimal render entry — registers ONLY FiveWaysEdit so the bundle doesn't load every other
// composition's @remotion/google-fonts (which fire ~96 network requests each, time out, retry,
// and over-count frames until the CLI crashes at finalize). Importing ./motion/kit for its
// side-effect loads the exact fonts FiveWaysEdit uses (Space Grotesk / JetBrains Mono / Playfair).
import { Composition, registerRoot } from "remotion";
import { FiveWaysEdit } from "./FiveWaysEdit";
import "./motion/kit";

const RenderRoot: React.FC = () => (
  <Composition
    id="FiveWaysEdit"
    component={FiveWaysEdit}
    durationInFrames={16832}
    fps={25}
    width={1920}
    height={1080}
  />
);

registerRoot(RenderRoot);
