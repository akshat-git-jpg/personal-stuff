// DEPRECATED — kept so nothing breaks mid-flight. The capability query lives in
// lib/intro-modes.mjs now; see the "why" there. New code calls ownsIntroSpan /
// introSpanFor, and lib/intro-modes.test.mjs FAILS if a lib source calls these.
import { ownsIntroSpan, introSpanFor } from '../intro-modes.mjs';
export const introOwnedByFilm = ownsIntroSpan;
export const filmSpanFor = introSpanFor;
