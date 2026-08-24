import React from "react";
import { Composition } from "remotion";
import { LoopStudioIntroLI } from "./LoopStudioIntroLI";
export const Root: React.FC = () => (
  <Composition id="LoopStudioIntroLI" component={LoopStudioIntroLI}
    durationInFrames={650} fps={30} width={1920} height={1080} />
);
