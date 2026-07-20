import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import {
  adjustStock,
  categorySchema,
  deleteProduct,
  createCategory,
  createProduct,
  getProduct,
  listCategories,
  listProducts,
  productSchema,
  updateProduct,
} from './product.service.js';

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = queryString(req, "q");
    const categoryId = queryString(req, "categoryId");
    const lowStock = queryString(req, "lowStock") === 'true';
    const page = req.query.page ? Number(queryString(req, "page")) : 1;
    const limit = req.query.limit ? Number(queryString(req, "limit")) : 50;
    const data = await listProducts({ q, categoryId, lowStock, page, limit });
    res.json({ success: true, data });
  })
);

productRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const data = await listCategories();
    res.json({ success: true, data });
  })
);

productRouter.post(
  '/categories',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const data = await createCategory(body.name);
    res.status(201).json({ success: true, data });
  })
);

productRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await getProduct(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);

productRouter.post(
  '/',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const body = productSchema.parse(req.body);
    const data = await createProduct(body);
    res.status(201).json({ success: true, data });
  })
);

productRouter.put(
  '/:id',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const body = productSchema.partial().parse(req.body);
    const data = await updateProduct(paramString(req, 'id'), body);
    res.json({ success: true, data });
  })
);


productRouter.delete(
  '/:id',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const data = await deleteProduct(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);

productRouter.post(
  '/:id/adjust-stock',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        quantity: z.coerce.number().int(),
        note: z.string().optional(),
      })
      .parse(req.body);
    const data = await adjustStock(paramString(req, 'id'), body.quantity, body.note);
    res.json({ success: true, data });
  })
);
