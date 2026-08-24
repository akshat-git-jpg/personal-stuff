import { AbsoluteFill, Composition, staticFile } from "remotion";
import { EditedVideo, type EditedVideoProps } from "./EditedVideo";
import { StyleShowcase } from "./StyleShowcase";
import { HiggsIntro } from "./HiggsIntro";
import { VideoEditIntro } from "./VideoEditIntro";
import { BusinessBrainIntro } from "./BusinessBrainIntro";
import { SchematicHero } from "./SchematicHero";
import { BrainBuildV2 } from "./BrainBuildV2";
import { BusinessBrainBody } from "./BusinessBrainBody";
import { BusinessAlive } from "./BusinessAlive";
import { ConduitWorld } from "./ConduitWorld";
import { PaperWorld } from "./PaperWorld";
import { BrandBoard } from "./BrandBoard";
import { InkTest } from "./bb/InkTest";
import { Avatar3Short } from "./Avatar3Short";
import { BoardProbe } from "./bb/Probe";
import { BusinessBrainFilm, FILM_DURATION } from "./BusinessBrainFilm";
import { MachineBoard } from "./bb/Machine";
import { BakeoffA } from "./BakeoffA";
import { BakeoffC } from "./BakeoffC";
import { BakeoffD } from "./BakeoffD";
import { BakeoffE } from "./BakeoffE";
import { Act1 } from "./Act1";
import { Act2 } from "./Act2";
import { Act3 } from "./Act3";
import { Act4 } from "./Act4";
import { LSAct1 } from "./LSAct1";
import { LSAct2 } from "./LSAct2";
import { LSAct3 } from "./LSAct3";
import { LSAct4 } from "./LSAct4";
import { LoopStudioIntroBB } from "./LoopStudioIntroBB";
import { CvCIntro } from "./CvCIntro";
import { CvCIntroV6 } from "./CvCIntroV6";
import { AiDocScene } from "./AiDocScene";
import { BakeoffB } from "./BakeoffB";

const MachineTestFrame = () => <MachineBoard />;
import { FiveWaysEdit } from "./FiveWaysEdit";
import { FishIntro } from "./FishIntro";
import { FishIntro3 } from "./FishIntro3";
import { FishIntro2 } from "./FishIntro2";
import { FishShort } from "./FishShort";
import { FishHero1 } from "./FishHero1";
import { FishHero2 } from "./FishHero2";
import { FishShort2VoiceProof } from "./FishShort2VoiceProof";
import { S83Short } from "./shorts/S83Short";
import { FishOutro } from "./FishOutro";
import { FishOutro3 } from "./FishOutro3";
import { DarkGridBg, LightGridBg } from "./templates/Backgrounds";
import { PromptMachineShort } from "./shorts/PromptMachineShort";
import { StoppedCheckingShort } from "./shorts/StoppedCheckingShort";
import { LessIsMoreShort } from "./shorts/LessIsMoreShort";
import { LeftLovableShort } from "./shorts/LeftLovableShort";
import { AiLonelyShort } from "./shorts/AiLonelyShort";
import { AiEmployeeIntro } from "./shorts/AiEmployeeIntro";
import { MachineIntro } from "./shorts/MachineIntro";
import { WaveIntro } from "./shorts/WaveIntro";
import { YtIntro } from "./shorts/YtIntro";
import { BillShowcase } from "./shorts/BillShowcase";
import { EditShowcase } from "./shorts/EditShowcase";
import { SubscribeBreak } from "./shorts/SubscribeBreak";
import { OutroCredits } from "./shorts/OutroCredits";
import { RoamIntro, ROAM_INTRO_FRAMES } from "./RoamIntro";
import { BrandIntro, BRAND_INTRO_FRAMES } from "./BrandIntro";
import { BrandOutro, BRAND_OUTRO_FRAMES } from "./BrandOutro";
import { BrandTut, BRAND_TUT_FRAMES } from "./BrandTut";
import { Plan, planDuration } from "./motion/Plan";
import demoPlan from "./motion/showcase-plan.json";
import overlayPlan from "./motion/overlay-plan.json";
import props from "./props.json";

const demoScenes = (demoPlan as { scenes: { durationInFrames: number }[] }).scenes;
const overlayScenes = (overlayPlan as { scenes: { durationInFrames: number }[] }).scenes;

const DarkGridFrame = () => <AbsoluteFill><DarkGridBg /></AbsoluteFill>;
const LightGridFrame = () => <AbsoluteFill><LightGridBg /></AbsoluteFill>;

const typed = props as unknown as EditedVideoProps & {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition id="AiDocScene" component={AiDocScene} durationInFrames={700} fps={25} width={1920} height={1080} />
      <Composition id="CvCIntro" component={CvCIntro} durationInFrames={614} fps={25} width={1920} height={1080} />
      <Composition id="CvCIntroV6" component={CvCIntroV6} durationInFrames={614} fps={25} width={1920} height={1080} />
      <Composition id="RoamIntro" component={RoamIntro} durationInFrames={ROAM_INTRO_FRAMES} fps={30} width={3840} height={2160} />
      <Composition id="BrandIntro" component={BrandIntro} durationInFrames={BRAND_INTRO_FRAMES} fps={30} width={3840} height={2160} />
      <Composition id="BrandOutro" component={BrandOutro} durationInFrames={BRAND_OUTRO_FRAMES} fps={30} width={3840} height={2160} />
      <Composition id="BrandTut" component={BrandTut} durationInFrames={BRAND_TUT_FRAMES} fps={30} width={3840} height={2160} />
      <Composition id="BusinessBrainIntro" component={BusinessBrainIntro} durationInFrames={561} fps={30} width={3840} height={2160} />
      <Composition id="SchematicHero" component={SchematicHero} durationInFrames={345} fps={30} width={3840} height={2160} />
      <Composition id="BrainBuildV2" component={BrainBuildV2} durationInFrames={540} fps={30} width={3840} height={2160} />
      <Composition id="BusinessBrainBody" component={BusinessBrainBody} durationInFrames={12930} fps={30} width={3840} height={2160} />
      <Composition id="BusinessAlive" component={BusinessAlive} durationInFrames={270} fps={30} width={3840} height={2160} />
      <Composition id="ConduitWorld" component={ConduitWorld} durationInFrames={420} fps={30} width={3840} height={2160} />
      <Composition id="PaperWorld" component={PaperWorld} durationInFrames={300} fps={30} width={3840} height={2160} />
      <Composition id="BrandBoard" component={BrandBoard} durationInFrames={285} fps={30} width={1920} height={1080} />
      <Composition id="InkTest" component={InkTest} durationInFrames={90} fps={30} width={1920} height={1080} />
      <Composition id="Avatar3Short" component={Avatar3Short} durationInFrames={212} fps={30} width={1080} height={1920} />
      <Composition id="BoardProbe" component={BoardProbe as never} durationInFrames={300} fps={30} width={1920} height={1080} defaultProps={{ archetype: "statement", spec: { headline: "PLACEHOLDER", markerWord: "PLACEHOLDER" } } as never} />
      <Composition id="BusinessBrainFilm" component={BusinessBrainFilm} durationInFrames={FILM_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="MachineTest" component={MachineTestFrame} durationInFrames={2400} fps={30} width={1920} height={1080} />
      <Composition id="BakeoffA" component={BakeoffA} durationInFrames={834} fps={30} width={1920} height={1080} />
      <Composition id="BakeoffC" component={BakeoffC} durationInFrames={834} fps={30} width={1920} height={1080} />
      <Composition id="BakeoffD" component={BakeoffD} durationInFrames={834} fps={30} width={1920} height={1080} />
      <Composition id="BakeoffE" component={BakeoffE} durationInFrames={834} fps={30} width={1920} height={1080} />
      <Composition id="Act4" component={Act4} durationInFrames={1608} fps={30} width={1920} height={1080} />
      <Composition id="LSAct1" component={LSAct1} durationInFrames={3253} fps={30} width={1920} height={1080} />
      <Composition id="LSAct2" component={LSAct2} durationInFrames={2265} fps={30} width={1920} height={1080} />
      <Composition id="LSAct3" component={LSAct3} durationInFrames={2598} fps={30} width={1920} height={1080} />
      <Composition id="LSAct4" component={LSAct4} durationInFrames={2621} fps={30} width={1920} height={1080} />
      <Composition id="LoopStudioIntroBB" component={LoopStudioIntroBB} durationInFrames={1125} fps={30} width={1920} height={1080} />
      <Composition id="Act3" component={Act3} durationInFrames={3420} fps={30} width={1920} height={1080} />
      <Composition id="Act2" component={Act2} durationInFrames={3645} fps={30} width={1920} height={1080} />
      <Composition id="Act1" component={Act1} durationInFrames={3693} fps={30} width={1920} height={1080} />
      <Composition id="BakeoffB" component={BakeoffB} durationInFrames={834} fps={30} width={1920} height={1080} />
      <Composition id="OutroCredits" component={OutroCredits} durationInFrames={241} fps={30} width={3840} height={2160} />
      <Composition id="SubscribeBreak" component={SubscribeBreak} durationInFrames={305} fps={30} width={3840} height={2160} />
      <Composition id="EditShowcase" component={EditShowcase} durationInFrames={1620} fps={30} width={1920} height={1080} />
      <Composition id="BillShowcase" component={BillShowcase} durationInFrames={1375} fps={30} width={1080} height={1920} />
      <Composition id="AiEmployeeIntro" component={AiEmployeeIntro} durationInFrames={445} fps={30} width={1920} height={1080} />
      <Composition id="MachineIntro" component={MachineIntro} durationInFrames={352} fps={30} width={3840} height={2160} />
      <Composition id="WaveIntro" component={WaveIntro} durationInFrames={383} fps={30} width={1080} height={1920} />
      <Composition id="YtIntro" component={YtIntro} durationInFrames={242} fps={30} width={1080} height={1920} />
      <Composition id="PromptMachineShort" component={PromptMachineShort} durationInFrames={2511} fps={30} width={1080} height={1920} />
      <Composition id="StoppedCheckingShort" component={StoppedCheckingShort} durationInFrames={1662} fps={30} width={1080} height={1920} />
      <Composition id="LessIsMoreShort" component={LessIsMoreShort} durationInFrames={1134} fps={30} width={1080} height={1920} />
      <Composition id="LeftLovableShort" component={LeftLovableShort} durationInFrames={1404} fps={30} width={1080} height={1920} />
      <Composition id="S83Short" component={S83Short} durationInFrames={1300} fps={30} width={1080} height={1920} />
      <Composition id="AiLonelyShort" component={AiLonelyShort} durationInFrames={1725} fps={30} width={1080} height={1920} />
      <Composition
        id="FishOutro3"
        component={FishOutro3}
        durationInFrames={593}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="FishOutro"
        component={FishOutro}
        durationInFrames={650}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition id="FishHero1" component={FishHero1} durationInFrames={1165} fps={30} width={1080} height={1920} />
      <Composition id="FishHero2" component={FishHero2} durationInFrames={1201} fps={30} width={1080} height={1920} />
      <Composition id="FishShort2VoiceProof" component={FishShort2VoiceProof} durationInFrames={1132} fps={30} width={1080} height={1920} />
      <Composition
        id="FishShort1"
        component={FishShort}
        durationInFrames={1159}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ scene: 1 }}
      />
      <Composition
        id="FishShort2"
        component={FishShort}
        durationInFrames={1201}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ scene: 2 }}
      />
      <Composition
        id="FishIntro2"
        component={FishIntro2}
        durationInFrames={1491}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="FishIntro3"
        component={FishIntro3}
        durationInFrames={1144}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="FishIntro"
        component={FishIntro}
        durationInFrames={1348}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="FiveWaysEdit"
        component={FiveWaysEdit}
        durationInFrames={16832}
        fps={25}
        width={1920}
        height={1080}
      />
      <Composition
        id="VideoEditIntro"
        component={VideoEditIntro}
        durationInFrames={708}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="HiggsIntro"
        component={HiggsIntro}
        durationInFrames={766}
        fps={30}
        width={3840}
        height={2160}
      />
      <Composition
        id="EditedVideo"
        component={EditedVideo}
        durationInFrames={typed.durationInFrames}
        fps={typed.fps}
        width={typed.width}
        height={typed.height}
        defaultProps={typed}
      />
      <Composition
        id="CinematicDemo"
        component={Plan as never}
        durationInFrames={planDuration(demoScenes)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ scenes: demoScenes } as never}
      />
      <Composition
        id="OverlayDemo"
        component={Plan as never}
        durationInFrames={planDuration(overlayScenes, false)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ scenes: overlayScenes, transparent: true } as never}
      />
      <Composition
        id="StyleShowcase"
        component={StyleShowcase}
        durationInFrames={30 * 125}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* 16:9 variant for verifying landscape templates side-by-side. */}
      <Composition
        id="StyleShowcaseLandscape"
        component={StyleShowcase}
        durationInFrames={30 * 125}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="DarkGridFrame"
        component={DarkGridFrame}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="LightGridFrame"
        component={LightGridFrame}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

// Re-exported so Remotion picks it up
export { staticFile };
