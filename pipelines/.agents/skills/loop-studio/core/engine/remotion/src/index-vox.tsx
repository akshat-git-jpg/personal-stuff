import { Composition, registerRoot } from "remotion";
import { VoxTest } from "./VoxTest";
import { VoxTestV2 } from "./VoxTestV2";
import { VoxTestV4 } from "./VoxTestV4";
import { VoxTestV5 } from "./VoxTestV5";
import { VoxTestV6 } from "./VoxTestV6";
import { VoxTestV7 } from "./VoxTestV7";
import { VoxTestV8 } from "./VoxTestV8";
import { VoxTestV9 } from "./VoxTestV9";

const D = 465; // 15.5s @ 30fps
const VoxRoot: React.FC = () => (
  <>
    <Composition id="VoxCanvas"   component={VoxTest} durationInFrames={D} fps={30} width={1920} height={1080} defaultProps={{ mode: "canvas"   as const }} />
    <Composition id="VoxSeedance" component={VoxTest} durationInFrames={D} fps={30} width={1920} height={1080} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxKling"    component={VoxTest} durationInFrames={D} fps={30} width={1920} height={1080} defaultProps={{ mode: "kling"    as const }} />
    <Composition id="VoxV2"       component={VoxTestV2} durationInFrames={D} fps={30} width={1920} height={1080} defaultProps={{ mode: "seedance" as const, set: "v1" as const }} />
    <Composition id="VoxV3"       component={VoxTestV2} durationInFrames={D} fps={30} width={1920} height={1080} defaultProps={{ mode: "seedance" as const, set: "v2" as const }} />
    {/* 720p — faster/cheaper iteration pass. Blur scales by width so it matches 1080p. */}
    <Composition id="VoxV4"       component={VoxTestV4} durationInFrames={D} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxV5"       component={VoxTestV5} durationInFrames={D} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxV6"       component={VoxTestV6} durationInFrames={D} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxV7"       component={VoxTestV7} durationInFrames={D} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxV8"       component={VoxTestV8} durationInFrames={534} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
    <Composition id="VoxV9"       component={VoxTestV9} durationInFrames={534} fps={30} width={1280} height={720} defaultProps={{ mode: "seedance" as const }} />
  </>
);
registerRoot(VoxRoot);
