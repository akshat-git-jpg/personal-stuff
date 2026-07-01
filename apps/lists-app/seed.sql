-- Demo data for local dev. Wipes + reseeds. Run via `npm run seed:local`.
DELETE FROM items;
DELETE FROM categories;

INSERT INTO categories (id, name, position, created_at) VALUES
  ('cat-yt',     'YouTube channel ideas', 0, 1751328000000),
  ('cat-skills', 'Skills to learn',       1, 1751328000000),
  ('cat-read',   'Books to read',         2, 1751328000000);

INSERT INTO items (id, category_id, text, position, created_at) VALUES
  ('it-1', 'cat-yt',     'Faceless automation channel walkthroughs', 0, 1751328000000),
  ('it-2', 'cat-yt',     'Cloudflare Workers tutorials',             1, 1751328000000),
  ('it-3', 'cat-yt',     'Build-in-public devlogs',                  2, 1751328000000),
  ('it-4', 'cat-skills', 'Rust basics',                              0, 1751328000000),
  ('it-5', 'cat-skills', 'OKLCH color theory',                       1, 1751328000000),
  ('it-6', 'cat-read',   'The Pragmatic Programmer',                 0, 1751328000000);
