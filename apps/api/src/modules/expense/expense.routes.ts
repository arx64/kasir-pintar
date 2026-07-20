import { Router } from 'express';
import { ExpenseCategory } from '@prisma/client';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { parseDateRange } from '../../utils/date.js';
import {
  createExpense,
  deleteExpense,
  expenseSchema,
  getExpense,
  listExpenses,
} from './expense.service.js';

export const expenseRouter = Router();

expenseRouter.use(authenticate);

expenseRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const fromStr = queryString(req, "from");
    const toStr = queryString(req, "to");
    const { start, end } = fromStr || toStr ? parseDateRange(fromStr, toStr) : { start: undefined, end: undefined };
    const category = queryString(req, "category") as ExpenseCategory | undefined;
    const page = req.query.page ? Number(queryString(req, "page")) : 1;
    const limit = req.query.limit ? Number(queryString(req, "limit")) : 20;

    const data = await listExpenses({ from: start, to: end, category, page, limit });
    res.json({ success: true, data });
  })
);

expenseRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await getExpense(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);

expenseRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);
    const data = await createExpense(req.user!.id, body);
    res.status(201).json({ success: true, data });
  })
);

expenseRouter.delete(
  '/:id',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const data = await deleteExpense(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);
