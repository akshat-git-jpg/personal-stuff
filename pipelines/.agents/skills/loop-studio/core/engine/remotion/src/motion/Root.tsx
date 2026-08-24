import React from "react";
import { Composition } from "remotion";
import { Plan, planDuration, PlanProps } from "./Plan";
import sample from "./sample-plan.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Plan"
      component={Plan}
      defaultProps={sample as unknown as PlanProps}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={planDuration((sample as unknown as PlanProps).scenes)}
      calculateMetadata={({ props }) => ({
        durationInFrames: planDuration((props as PlanProps).scenes),
        fps: 30,
        width: 1920,
        height: 1080,
      })}
    />
  );
};
