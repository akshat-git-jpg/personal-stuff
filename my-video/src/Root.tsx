import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { TestAnim } from "./TestAnim";
import { ZluriLogo } from "./ZluriLogo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={60}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="TestAnim"
        component={TestAnim}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="ZluriLogo"
        component={ZluriLogo}
        durationInFrames={60}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
