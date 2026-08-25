import React from "react";
import {Composition} from "remotion";
import {CvCIntro} from "./CvCIntro";

export const CvCIntroRoot: React.FC = () => (
  <Composition
    id="CvCIntro"
    component={CvCIntro}
    durationInFrames={614}
    fps={25}
    width={1920}
    height={1080}
  />
);
