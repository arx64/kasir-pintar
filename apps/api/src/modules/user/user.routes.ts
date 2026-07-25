import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import {
  createUser,
  createUserSchema,
  getUser,
  listUsers,
  resetPassword,
  toggleUserActive,
  updateUser,
  updateUserSchema,
} from './user.service.js';

export const userRouter = Router();

userRouter.use(authenticate, authorize('OWNER'));

userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = queryString(req, 'role') as Role | undefined;
    const isActive =
      queryString(req, 'isActive') === 'true'
        ? true
        : queryString(req, 'isActive') === 'false'
        ? false
        : undefined;
    const q = queryString(req, 'q');
    const data = await listUsers({ role, isActive, q });
    res.json({ success: true, data });
  })
);

userRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await getUser(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);

userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const data = await createUser(body);
    res.status(201).json({ success: true, data });
  })
);

userRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const data = await updateUser(paramString(req, 'id'), body);
    res.json({ success: true, data });
  })
);

userRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { password } = req.body as { password?: string };
    if (!password) {
      return res.status(400).json({ success: false, message: 'password wajib' });
    }
    const data = await resetPassword(paramString(req, 'id'), password);
    res.json({ success: true, data });
  })
);

userRouter.post(
  '/:id/toggle-active',
  asyncHandler(async (req, res) => {
    const data = await toggleUserActive(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);
