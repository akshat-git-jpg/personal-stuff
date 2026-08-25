import { Composition, registerRoot } from "remotion";
import { IntroBroll } from "./IntroBroll";
const Root: React.FC = () => (
  <Composition id="IntroBroll" component={IntroBroll} durationInFrames={1296} fps={30} width={1920} height={1080} />
);
registerRoot(Root);
