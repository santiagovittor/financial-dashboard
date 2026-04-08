/**
 * Development seed — multi-month realistic data.
 *
 * Covers 3 months: 2 months ago, last month, current month.
 * Safe to run multiple times — skips if the owner user already exists.
 *
 * Run with: pnpm db:seed (from apps/api) or prisma db seed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

async function main() {
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log('Database already seeded — skipping.');
    return;
  }

  const owner = await prisma.user.create({
    data: {
      email: process.env['OWNER_EMAIL'] ?? 'owner@example.com',
      name: 'Owner',
    },
  });
  console.log(`Created user: ${owner.email}`);

  // ── Dates ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 3 months of data: current - 2, current - 1, current
  const months = [-2, -1, 0].map((offset) => {
    let m = currentMonth + offset;
    let y = currentYear;
    while (m <= 0) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    return { year: y, month: m };
  });

  // ── Exchange rate snapshots (history) ─────────────────────────────────────
  // Simulate a gradual USD/ARS appreciation over the period
  const rateHistory = [
    { offset: -90, rate: 1050 },
    { offset: -60, rate: 1100 },
    { offset: -30, rate: 1150 },
    { offset: 0,   rate: 1200 },
  ];

  const usdSnapshots = await Promise.all(
    rateHistory.map(({ offset, rate }) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      return prisma.exchangeRateSnapshot.create({
        data: {
          userId: owner.id,
          fromCurrency: 'USD',
          toCurrency: 'ARS',
          rate,
          effectiveDate: d,
          isManual: true,
          notes: `Dev seed rate — ${rate} ARS/USD`,
        },
      });
    }),
  );

  await Promise.all(
    rateHistory.map(({ offset, rate }) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      return prisma.exchangeRateSnapshot.create({
        data: {
          userId: owner.id,
          fromCurrency: 'USDT',
          toCurrency: 'ARS',
          rate: rate - 10, // USDT at slight discount
          effectiveDate: d,
          isManual: true,
          notes: `Dev seed rate — USDT`,
        },
      });
    }),
  );

  const latestUsdSnapshot = usdSnapshots[usdSnapshots.length - 1]!;
  console.log('Created exchange rate history');

  // ── Expense categories ────────────────────────────────────────────────────
  const [foodCat, transportCat, subsCat, healthCat, utilitiesCat, entertainmentCat] =
    await Promise.all([
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Food & Dining', color: '#f59e0b' } }),
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Transport', color: '#3b82f6' } }),
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Subscriptions', color: '#8b5cf6' } }),
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Health', color: '#10b981' } }),
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Utilities', color: '#6b7280' } }),
      prisma.expenseCategory.create({ data: { userId: owner.id, name: 'Entertainment', color: '#f43f5e' } }),
    ]);
  console.log('Created expense categories');

  // ── Recurring commitments ─────────────────────────────────────────────────
  // Rent — has an effective-date price change mid-period
  const rentCommitment = await prisma.recurringCommitment.create({
    data: {
      userId: owner.id,
      name: 'Rent',
      type: 'RENT',
      dayOfMonth: 1,
      startDate: new Date('2024-01-01'),
      isActive: true,
      notes: 'Monthly apartment rent',
    },
  });
  // First version (older rate)
  const twoMonthsAgo = months[0]!;
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: rentCommitment.id,
      effectiveFrom: new Date('2024-01-01'),
      originalAmount: 80_000,
      originalCurrency: 'ARS',
      notes: 'Original rate',
    },
  });
  // Price increase effective last month
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: rentCommitment.id,
      effectiveFrom: monthStart(months[1]!.year, months[1]!.month),
      originalAmount: 95_000,
      originalCurrency: 'ARS',
      notes: 'Adjusted for inflation',
    },
  });

  // Streaming bundle — USD, with a past price increase
  const streamingCommitment = await prisma.recurringCommitment.create({
    data: {
      userId: owner.id,
      name: 'Streaming Bundle',
      type: 'SUBSCRIPTION',
      categoryId: subsCat!.id,
      dayOfMonth: 15,
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  });
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: streamingCommitment.id,
      effectiveFrom: new Date('2024-01-01'),
      originalAmount: 20,
      originalCurrency: 'USD',
      notes: 'Initial rate',
    },
  });
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: streamingCommitment.id,
      effectiveFrom: new Date('2025-01-01'),
      originalAmount: 25,
      originalCurrency: 'USD',
      notes: 'Price increase Jan 2025',
    },
  });

  // Gym — ARS fixed monthly
  const gymCommitment = await prisma.recurringCommitment.create({
    data: {
      userId: owner.id,
      name: 'Gym',
      type: 'SERVICE',
      categoryId: healthCat!.id,
      dayOfMonth: 5,
      startDate: new Date('2025-03-01'),
      isActive: true,
    },
  });
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: gymCommitment.id,
      effectiveFrom: new Date('2025-03-01'),
      originalAmount: 35_000,
      originalCurrency: 'ARS',
    },
  });

  // Internet — deactivated old commitment (shows in history)
  const oldInternetCommitment = await prisma.recurringCommitment.create({
    data: {
      userId: owner.id,
      name: 'Old ISP',
      type: 'UTILITY',
      categoryId: utilitiesCat!.id,
      dayOfMonth: 10,
      startDate: new Date('2024-01-01'),
      endDate: monthStart(twoMonthsAgo.year, twoMonthsAgo.month),
      isActive: false,
      notes: 'Cancelled — switched providers',
    },
  });
  await prisma.recurringCommitmentVersion.create({
    data: {
      commitmentId: oldInternetCommitment.id,
      effectiveFrom: new Date('2024-01-01'),
      originalAmount: 12_000,
      originalCurrency: 'ARS',
    },
  });

  console.log('Created recurring commitments');

  // ── Debts ─────────────────────────────────────────────────────────────────
  const creditCard = await prisma.debt.create({
    data: {
      userId: owner.id,
      name: 'Visa Credit Card',
      type: 'REVOLVING',
      originalPrincipal: 800,
      principalCurrency: 'USD',
      fxRate: 1200,
      arsPrincipal: 960_000,
      fxSnapshotId: latestUsdSnapshot.id,
      openedAt: new Date('2024-01-01'),
      creditLimitOriginal: 3000,
      currentBalanceOriginal: 450,
      currentBalanceCurrency: 'USD',
      status: 'ACTIVE',
      notes: 'Primary credit card',
    },
  });

  const carLoan = await prisma.debt.create({
    data: {
      userId: owner.id,
      name: 'Car Loan',
      type: 'FIXED_INSTALLMENT',
      originalPrincipal: 5_000_000,
      principalCurrency: 'ARS',
      fxRate: 1,
      arsPrincipal: 5_000_000,
      openedAt: new Date('2025-01-01'),
      installmentCount: 36,
      installmentAmount: 180_000,
      installmentCurrency: 'ARS',
      currentBalanceOriginal: 4_140_000,
      currentBalanceCurrency: 'ARS',
      status: 'ACTIVE',
    },
  });

  console.log('Created debts');

  // ── Income plans + entries + expense entries + debt payments (per month) ──
  for (const { year, month } of months) {
    const totalDays = daysInMonth(year, month);
    const fxRateForMonth = month === currentMonth ? 1200
      : month === months[1]!.month && year === months[1]!.year ? 1150
      : 1100;

    // Income plan
    await prisma.monthlyIncomePlan.create({
      data: {
        userId: owner.id,
        year,
        month,
        estimatedOriginal: 1500,
        estimatedCurrency: 'USD',
        fxRate: fxRateForMonth,
        estimatedArs: 1500 * fxRateForMonth,
        notes: 'Monthly USD salary estimate',
      },
    });

    // Actual income — salary arrives around day 5, sometimes a bonus mid-month
    const salaryArs = 1450 * fxRateForMonth; // slightly below plan
    const fxSnapshot = usdSnapshots.find((s) =>
      s.effectiveDate <= new Date(year, month - 1, 5),
    ) ?? latestUsdSnapshot;

    await prisma.incomeEntry.create({
      data: {
        userId: owner.id,
        entryDate: new Date(year, month - 1, 5),
        description: 'Monthly salary',
        originalAmount: 1450,
        originalCurrency: 'USD',
        fxRate: fxRateForMonth,
        arsAmount: salaryArs,
        fxSnapshotId: fxSnapshot.id,
        source: 'MANUAL',
      },
    });

    // Bonus income in past months only
    if (month !== currentMonth) {
      const bonusArs = 50 * fxRateForMonth;
      await prisma.incomeEntry.create({
        data: {
          userId: owner.id,
          entryDate: new Date(year, month - 1, 20),
          description: 'Freelance bonus',
          originalAmount: 50,
          originalCurrency: 'USD',
          fxRate: fxRateForMonth,
          arsAmount: bonusArs,
          fxSnapshotId: fxSnapshot.id,
          source: 'MANUAL',
        },
      });
    }

    // Expense entries — spread across the month
    const expenseData = [
      { day: 3, desc: 'Supermarket weekly', ars: randomBetween(18_000, 25_000), catId: foodCat!.id },
      { day: 7, desc: 'Bus card top-up', ars: 8_000, catId: transportCat!.id },
      { day: 10, desc: 'Supermarket weekly', ars: randomBetween(18_000, 25_000), catId: foodCat!.id },
      { day: 12, desc: 'Doctor visit', ars: 15_000, catId: healthCat!.id },
      { day: 15, desc: 'Streaming Bundle', ars: 25 * fxRateForMonth, catId: subsCat!.id },
      { day: 17, desc: 'Supermarket weekly', ars: randomBetween(18_000, 25_000), catId: foodCat!.id },
      { day: 20, desc: 'Electricity bill', ars: randomBetween(12_000, 18_000), catId: utilitiesCat!.id },
      { day: 22, desc: 'Restaurant dinner', ars: randomBetween(25_000, 40_000), catId: entertainmentCat!.id },
      { day: 25, desc: 'Supermarket weekly', ars: randomBetween(18_000, 25_000), catId: foodCat!.id },
    ];

    // For current month, only include expenses up to today
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (const e of expenseData) {
      const entryDate = new Date(year, month - 1, Math.min(e.day, totalDays));
      if (entryDate > today) continue;

      await prisma.expenseEntry.create({
        data: {
          userId: owner.id,
          entryDate,
          description: e.desc,
          categoryId: e.catId,
          originalAmount: e.ars,
          originalCurrency: 'ARS',
          fxRate: 1,
          arsAmount: e.ars,
          source: 'MANUAL',
        },
      });
    }

    // Debt payments — credit card minimum + car loan installment
    const paymentDate = new Date(year, month - 1, 10);
    if (paymentDate <= today) {
      await prisma.debtPayment.create({
        data: {
          debtId: creditCard.id,
          userId: owner.id,
          paymentDate,
          originalAmount: 100,
          originalCurrency: 'USD',
          fxRate: fxRateForMonth,
          arsAmount: 100 * fxRateForMonth,
          fxSnapshotId: fxSnapshot.id,
          isMinimumPayment: true,
          notes: 'Credit card minimum payment',
          source: 'MANUAL',
        },
      });
      await prisma.debt.update({
        where: { id: creditCard.id },
        data: { currentBalanceOriginal: { decrement: 100 } },
      });
    }

    const carPaymentDate = new Date(year, month - 1, 5);
    if (carPaymentDate <= today) {
      await prisma.debtPayment.create({
        data: {
          debtId: carLoan.id,
          userId: owner.id,
          paymentDate: carPaymentDate,
          originalAmount: 180_000,
          originalCurrency: 'ARS',
          fxRate: 1,
          arsAmount: 180_000,
          isMinimumPayment: false,
          notes: 'Car loan installment',
          source: 'MANUAL',
        },
      });
      await prisma.debt.update({
        where: { id: carLoan.id },
        data: { currentBalanceOriginal: { decrement: 180_000 } },
      });
    }
  }

  console.log('Created income plans, income entries, expense entries, and debt payments');

  // ── Savings goal ──────────────────────────────────────────────────────────
  await prisma.goal.create({
    data: {
      userId: owner.id,
      name: 'Emergency Fund',
      targetArs: 5_000_000,
      currentArs: 800_000,
      targetDate: new Date(currentYear + 1, 5, 1), // June next year
      notes: '6 months of expenses',
    },
  });

  await prisma.goal.create({
    data: {
      userId: owner.id,
      name: 'Laptop Upgrade',
      targetArs: 1_200_000,
      currentArs: 300_000,
      targetDate: new Date(currentYear, 11, 1), // December this year
    },
  });

  console.log('Created goals');

  // ── Risk settings ─────────────────────────────────────────────────────────
  await prisma.riskSetting.createMany({
    data: [
      {
        userId: owner.id,
        key: 'daily_spend_warning_ratio',
        value: 0.8,
        description: 'Warn when daily spend reaches 80% of daily budget',
      },
      {
        userId: owner.id,
        key: 'daily_spend_danger_ratio',
        value: 1.0,
        description: 'Danger when daily spend exceeds daily budget',
      },
      {
        userId: owner.id,
        key: 'debt_to_income_warning_ratio',
        value: 0.3,
        description: 'Warn when monthly debt payments exceed 30% of income',
      },
      {
        userId: owner.id,
        key: 'debt_to_income_danger_ratio',
        value: 0.5,
        description: 'Danger when monthly debt payments exceed 50% of income',
      },
    ],
  });

  console.log('Created risk settings');
  console.log('\nSeed complete. 3 months of data created.');
  console.log(
    `Months seeded: ${months.map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`).join(', ')}`,
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
