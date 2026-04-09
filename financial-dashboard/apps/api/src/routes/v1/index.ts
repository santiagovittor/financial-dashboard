import { Router, type IRouter } from 'express';
import { authRouter } from '../../modules/auth/auth.router.js';
import { rateRouter } from '../../modules/rate/rate.router.js';
import { incomeRouter } from '../../modules/income/income.router.js';
import { expensesRouter } from '../../modules/expenses/expenses.router.js';
import { commitmentsRouter } from '../../modules/commitments/commitments.router.js';
import { debtsRouter } from '../../modules/debts/debts.router.js';
import { goalsRouter } from '../../modules/goals/goals.router.js';
import { risksRouter } from '../../modules/risks/risks.router.js';
import { documentsRouter } from '../../modules/documents/documents.router.js';
import { budgetRouter } from '../../modules/budget/budget.router.js';
import { analysisRouter } from '../../modules/analysis/analysis.router.js';
import { healthRouter } from './health.js';
import { requireAuth } from '../../middleware/requireAuth.js';

const v1: IRouter = Router();

// Public — no auth required
v1.use('/health', healthRouter);
v1.use('/auth', authRouter);

// Blanket auth guard for everything below. Individual routers also call
// requireAuth (defence-in-depth) but this prevents any future route from
// accidentally being added without protection.
v1.use(requireAuth);

// Protected
v1.use('/rates', rateRouter);
v1.use('/income', incomeRouter);
v1.use('/expenses', expensesRouter);
v1.use('/commitments', commitmentsRouter);
v1.use('/debts', debtsRouter);
v1.use('/goals', goalsRouter);
v1.use('/risks', risksRouter);
v1.use('/documents', documentsRouter);
v1.use('/budget', budgetRouter);
v1.use('/analysis', analysisRouter);

export { v1 };
