import React from "react";
import { SectionOpen, Statement, Stream, DrawnConcept, Compare, Stat, QueryAnswer, Closer } from "./boards";
import { MachineBoard } from "./Machine";
const MAP: Record<string, React.FC<{ spec: any }>> = { sectionOpen: SectionOpen, statement: Statement, stream: Stream, drawnConcept: DrawnConcept, compare: Compare, stat: Stat, queryAnswer: QueryAnswer, closer: Closer };
export const BoardProbe: React.FC<{ archetype: string; spec: any }> = ({ archetype, spec }) => {
  if (archetype === "machine") return <MachineBoard stages={spec?.stages} />;
  const C = MAP[archetype] || Statement;
  return <C spec={spec || {}} />;
};
