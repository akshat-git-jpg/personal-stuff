import { AlertTriangle } from "lucide-react";

/** Shown where a system has nobody holding the Reviewer role. */
export function NoReviewerWarning({ systemName }: { systemName: string }) {
  return (
    <div role="alert" data-testid="no-reviewer-warning" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>Nobody can review in {systemName}: review stages will complete without review.</span>
    </div>
  );
}
