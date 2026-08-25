import { Composition } from "remotion";
import { AttentionOverlay, ATTENTION_DURATION } from "./AttentionOverlay";

export const Root: React.FC = () => (
  <Composition
    id="AttentionOverlay"
    component={AttentionOverlay}
    durationInFrames={ATTENTION_DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
);
