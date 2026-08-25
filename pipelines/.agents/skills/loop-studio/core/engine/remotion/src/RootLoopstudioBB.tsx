import React from "react";
import { Composition } from "remotion";
import { LoopStudioIntroBB } from "./LoopStudioIntroBB";
export const Root: React.FC = () => (
  <Composition id="LoopStudioIntroBB" component={LoopStudioIntroBB}
    durationInFrames={1125} fps={30} width={1920} height={1080} />
);
