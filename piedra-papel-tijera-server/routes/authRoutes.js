import { Router } from 'express';
import { login, register } from '../controllers/authController.js';

const router = Router();

// Ruta: POST /api/auth/register
router.post('/register', register);

// Ruta: POST /api/auth/login
router.post('/login', login);

export default router;