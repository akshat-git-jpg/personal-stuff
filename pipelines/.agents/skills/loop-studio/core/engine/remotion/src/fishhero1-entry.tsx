import React from "react";
import { Composition, registerRoot } from "remotion";
import { FishHero1 } from "./FishHero1";

const FishHero1Root: React.FC = () => (
  <Composition
    id="FishHero1"
    component={FishHero1}
    durationInFrames={1165}
    fps={30}
    width={1080}
    height={1920}
  />
);

registerRoot(FishHero1Root);
