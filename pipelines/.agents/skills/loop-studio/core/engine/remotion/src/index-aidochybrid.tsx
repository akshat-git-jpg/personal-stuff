import { Composition, registerRoot } from "remotion";
import { AiDocHybrid } from "./AiDocHybrid";

// minimal entry — only this comp's fonts load (keeps headless font loads under 5s)
const Root: React.FC = () => (
  <Composition id="AiDocHybrid" component={AiDocHybrid} durationInFrames={580} fps={25} width={1920} height={1080} />
);
registerRoot(Root);
