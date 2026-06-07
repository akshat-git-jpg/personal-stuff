import { Router } from 'express';
import { login, logout, me, changePassword, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.post('/change-password', requireAuth, changePassword);

export default router;
