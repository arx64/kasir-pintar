import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import {
  createCustomerRequest,
  listCustomerRequests,
  updateStatus,
} from './customer-request.service.js';

export const customerRequestRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  message: z.string().min(1),
});

// public submit
customerRequestRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const data = await createCustomerRequest(body);
    res.status(201).json({ success: true, data });
  })
);

customerRequestRouter.use(authenticate, authorize('OWNER'));

customerRequestRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = queryString(req, "status");
    const data = await listCustomerRequests(status);
    res.json({ success: true, data });
  })
);

customerRequestRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const status = z.string().min(1).parse(req.body.status);
    const data = await updateStatus(paramString(req, 'id'), status);
    res.json({ success: true, data });
  })
);
