import { Composition, registerRoot } from "remotion";
import { FvsMid, FvsOutro } from "./FvsCta";

const FvsRoot: React.FC = () => (
  <>
    <Composition id="FvsMid" component={FvsMid} durationInFrames={422} fps={30} width={1920} height={1080} />
    <Composition id="FvsOutro" component={FvsOutro} durationInFrames={277} fps={30} width={1920} height={1080} />
  </>
);
registerRoot(FvsRoot);
