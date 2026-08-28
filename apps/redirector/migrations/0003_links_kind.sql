-- Records whether a link is an affiliate link (should earn commission) or an
-- external link (a plain site with no affiliate program).
--
-- resolveSelection() has always computed this distinction, then discarded it at
-- INSERT time. Without it stored, no checker can tell "this link must carry an
-- affiliate code" from "a plain homepage is the correct destination here" — an
-- audit on 2026-08-28 wrongly flagged cursor/zapier/langchain as broken for
-- exactly this reason. The link guard depends on this column.
--
-- Additive and nullable, per the redirector's schema contract: analytics-app
-- reads this table and must keep working without knowing about the column.
-- NULL means "minted before this column existed, kind unknown".

ALTER TABLE links ADD COLUMN kind TEXT;

-- Backfill what can be inferred with certainty: our own redirect layer and the
-- known affiliate networks are never plain external links. Everything else is
-- left NULL rather than guessed, and the guard reports NULLs as unclassified.
UPDATE links SET kind = 'affiliate'
WHERE kind IS NULL AND (
  target_url LIKE '%agrolloo.com/%'
  OR target_url LIKE '%.sjv.io/%'
  OR target_url LIKE '%.pxf.io/%'
  OR target_url LIKE '%.prf.hn/%'
  OR target_url LIKE '%partnerlinks.io/%'
  OR target_url LIKE '%.grsm.io/%'
  OR target_url LIKE '%getrewardful.com%'
  OR target_url LIKE '%paykstrt.com/%'
  OR target_url LIKE '%envato.market/%'
  OR target_url LIKE '%?via=%'
  OR target_url LIKE '%&via=%'
  OR target_url LIKE '%?ref=%'
  OR target_url LIKE '%fpr=%'
  OR target_url LIKE '%fp_ref=%'
  OR target_url LIKE '%sca_ref=%'
  OR target_url LIKE '%aff=%'
);

CREATE INDEX IF NOT EXISTS idx_links_kind ON links(kind);
