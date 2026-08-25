/**
 * BusinessBrainFilm — the full ~7-min on-brand worksheet film (body).
 * Covers narration 18.70s → 431.10s (frame 0 = 18.70s). The cinematic intro is stitched on the front.
 * Data-driven from bb/film.json (authored + adversarially reviewed for brand + voice + cohesion).
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { SectionOpen, Statement, Stream, DrawnConcept, Compare, Stat, QueryAnswer, Closer } from "./bb/boards";
import { MachineBoard, MachineStages } from "./bb/Machine";
import film from "./bb/film.json";

type Beat = { id: number; start: number; end: number; archetype: string; spec: any; reason?: string };
const BEATS = film as Beat[];

const OFFSET = 18.7; // narration seconds at film frame 0 (intro ends here)
const FPS = 30;
export const FILM_DURATION = Math.round((431.1 - OFFSET) * FPS);
const F = (t: number) => Math.max(0, Math.round((t - OFFSET) * FPS));

const MAP: Record<string, React.FC<{ spec: any }>> = {
  sectionOpen: SectionOpen, statement: Statement, stream: Stream,
  drawnConcept: DrawnConcept, compare: Compare, stat: Stat, queryAnswer: QueryAnswer, closer: Closer,
};

// collapse the 9 machine beats into one progressive board + compute its stage times
const machineBeats = BEATS.filter((b) => b.archetype === "machine").sort((a, b) => a.start - b.start);
const mStart = machineBeats.length ? machineBeats[0].start : 0;
const mEnd = machineBeats.length ? machineBeats[machineBeats.length - 1].end : 0;
const STAGE_KEYS: (keyof MachineStages)[] = ["core", "lists", "loops", "fill", "skills", "howwhat", "dash", "model", "name"];
const machineStages: Partial<MachineStages> = {};
machineBeats.forEach((b, i) => { if (STAGE_KEYS[i]) machineStages[STAGE_KEYS[i]] = +(b.start - mStart).toFixed(2); });

export const BusinessBrainFilm: React.FC = () => {
  let machineEmitted = false;
  return (
    <AbsoluteFill>
      <Audio src={staticFile("intros/businessbrain/secondbrain_720.mp4")} startFrom={Math.round(OFFSET * FPS)} />
      {BEATS.map((b) => {
        if (b.archetype === "machine") {
          if (machineEmitted) return null;
          machineEmitted = true;
          const from = F(mStart);
          return (
            <Sequence key="machine" from={from} durationInFrames={Math.max(1, F(mEnd) - from)}>
              <MachineBoard stages={machineStages} />
            </Sequence>
          );
        }
        const C = MAP[b.archetype] || Statement;
        const from = F(b.start);
        return (
          <Sequence key={b.id} from={from} durationInFrames={Math.max(1, F(b.end) - from)}>
            <C spec={b.spec} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
