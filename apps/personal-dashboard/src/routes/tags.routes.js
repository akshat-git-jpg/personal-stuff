import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getAllTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

// GET /api/tags — returns all distinct tags used across all lists.
router.get('/', (req, res) => {
  res.json({ tags: getAllTags(db) });
});

export default router;
