// Domain types shared between the React client and the Cloudflare Worker.

/** A muscle-group tab in the spreadsheet. "Anu Gym" is a second gym whose rows
 *  carry their own muscleGroup column; the standard tabs are single-group. */
export interface Group {
  /** Tab name exactly as it appears in the sheet, e.g. "Chest" or "Anu Gym". */
  tab: string;
  /** Display label. */
  label: string;
  /** Number of exercises currently in the tab. */
  count: number;
  /** True for the "Anu Gym" tab which has a per-row Muscle Group column. */
  isMixed: boolean;
}

/** A single exercise row from a muscle-group tab. */
export interface Exercise {
  id: string;
  name: string;
  /** Machine setup / positioning notes. */
  setting: string;
  /** Free-text working sets/reps reference (the original column). */
  setsReps: string;
  /** Form cues / reminders. */
  notes: string;
  /** Only present for the mixed "Anu Gym" tab. */
  muscleGroup?: string;
  /** Tab this exercise lives in. */
  tab: string;
  /** Zero-based position within the tab (drives drag-reorder). */
  order: number;
}

/** A logged set from the Workout Log tab. */
export interface LogEntry {
  date: string; // ISO timestamp
  exerciseId: string;
  exercise: string;
  muscleGroup: string;
  setNo: number;
  weight: number;
  reps: number;
  notes: string;
}

/** Payload to create/update an exercise. */
export interface ExerciseInput {
  name: string;
  setting?: string;
  setsReps?: string;
  notes?: string;
  muscleGroup?: string;
}

export interface LogInput {
  /** Client-generated ISO timestamp; also the stable row key for edit/delete. */
  date?: string;
  exerciseId: string;
  exercise: string;
  muscleGroup: string;
  setNo: number;
  weight: number;
  reps: number;
  notes?: string;
}

/** Editable fields of a logged set. */
export interface LogPatch {
  weight?: number;
  reps?: number;
  notes?: string;
}

/** Bootstrap ships only this much log history; older loads lazily on demand. */
export const RECENT_LOG_DAYS = 120;

export const WORKOUT_LOG_TAB = "Workout Log";
export const WORKOUT_LOG_HEADER = [
  "Date",
  "ExerciseID",
  "Exercise",
  "MuscleGroup",
  "SetNo",
  "Weight",
  "Reps",
  "Notes",
];
