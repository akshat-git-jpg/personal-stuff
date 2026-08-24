import React from "react";
import { Page, InkLayer, useU, MONO, BODY } from "./Brand";
import { Ink, INK_NAMES } from "./Ink";

export const InkTest: React.FC = () => {
  const u = useU();
  const cols = 4;
  return (
    <Page wipe={false}>
      <InkLayer>
        {INK_NAMES.map((n, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const x = 6 + c * 23, y = 4 + r * 17;
          return <Ink key={n} name={n} x={x} y={y} w={16} at={0.2} />;
        })}
      </InkLayer>
      {INK_NAMES.map((n, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        return <div key={n} style={{ position: "absolute", left: `${(6 + c * 23) / 100 * 100}%`, top: `${(4 + r * 17 + 15) / 56.25 * 100}%`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1, letterSpacing: "0.1em", color: BODY }}>{n}</div>;
      })}
    </Page>
  );
};
