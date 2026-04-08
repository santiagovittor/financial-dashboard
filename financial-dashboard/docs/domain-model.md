# Domain Model

Finance domain for a single-owner personal finance app. ARS is the canonical reporting currency. Supported currencies: ARS, USD, USDT.

---

## Core Entities

### User
Single owner in v1. The schema uses `userId` foreign keys on all finance tables so multi-user support can be added without schema migrations — just remove the owner allowlist in auth.

### ExchangeRateSnapshot
Manual planning rates stored historically. Every rate is tied to a `fromCurrency → ARS` pair and an `effectiveDate`. The unique constraint `(userId, fromCurrency, toCurrency, effectiveDate)` prevents accidental duplicate entries.

In v1 all rates are `isManual = true`. A future step can add a market data source and set `isManual = false`.

### MonthlyIncomePlan
One row per `(userId, year, month)`. Stores the owner's estimated monthly income and the FX rate used to convert it to ARS. This is a planning estimate — it can be revised, so it is upserted rather than append-only.

### IncomeEntry
Actual income received. **Immutable once created.** Errors are corrected by recording a new offsetting entry or marking the original with a description, not by editing in place.

### ExpenseCategory / ExpenseEntry
Categories are soft-deletable (`isArchived`). Entries are **immutable once created**, same rationale as income.

### RecurringCommitment + RecurringCommitmentVersion
A commitment represents a recurring bill or subscription. Its amount can change over time. Instead of updating the amount field, a new `RecurringCommitmentVersion` row is appended with an `effectiveFrom` date.

**The arsAmount is intentionally absent from RecurringCommitmentVersion.** The ARS equivalent is computed at report time using the current planning FX rate, because future rates are unknown. Only `originalAmount` and `originalCurrency` are stored.

### Debt + DebtPayment + DebtScheduleItem
`Debt` supports two types:
- `FIXED_INSTALLMENT` — known number of payments. Use `installmentCount` and `installmentAmount`. Optional `DebtScheduleItem` rows track each installment.
- `REVOLVING` — open credit line. Use `creditLimitOriginal`.

Payments are **immutable** once recorded. The `currentBalanceOriginal` field on `Debt` is updated as payments come in — it is the only mutable financial field, acting as a running balance tracker.

### Goal
Simple target savings goal in ARS. `currentArs` is updated manually or programmatically. No automation in v1.

### RiskSetting
Key-value store for configurable risk thresholds. Known keys are defined as constants in `@fin/shared/RISK_KEYS`. Default values are in `DEFAULT_RISK_VALUES`. Validated server-side against the known key list.

### SourceDocument + DocumentExtraction + ExtractionReview
See [Document Flow](#document-flow) below.

---

## How Historical Accuracy Is Protected

Three patterns work together:

1. **No update on financial facts.** `IncomeEntry`, `ExpenseEntry`, `DebtPayment` have no update operations exposed. A mistake is corrected with a new entry, preserving the full audit trail.

2. **Append-only versioning for recurring amounts.** `RecurringCommitmentVersion` rows are never edited or deleted. The active version for any past date can always be reconstructed by taking `max(effectiveFrom) ≤ targetDate`.

3. **FX provenance on every monetary record.** Each monetary table stores `originalAmount`, `originalCurrency`, `fxRate`, and `arsAmount`. The `fxSnapshotId` links back to the exact snapshot used so the conversion can be audited. Recalculating an old record using today's rate is never done automatically.

---

## FX Provenance

Every monetary fact in the system must carry:

| Field | Meaning |
|---|---|
| `originalAmount` | Amount as entered, in original currency |
| `originalCurrency` | The currency the transaction was denominated in |
| `fxRate` | Rate applied: `1 originalCurrency = fxRate ARS` |
| `arsAmount` | `originalAmount × fxRate`, rounded to 4dp |
| `fxSnapshotId` | FK to the `ExchangeRateSnapshot` that provided `fxRate` (nullable for ARS transactions where rate = 1) |

For ARS-denominated entries, `fxRate = 1` and `arsAmount = originalAmount`. No snapshot is required.

The `@fin/shared` utility `toArs(originalAmount, currency, fxRate)` performs this calculation using `Decimal.js` to avoid floating-point accumulation errors.

---

## Recurring Amount Versioning

A recurring commitment has a list of versions, each with an `effectiveFrom` date:

```
Streaming Bundle
  version 1: effectiveFrom=2024-01-01, amount=USD 20
  version 2: effectiveFrom=2025-01-01, amount=USD 25
```

To find the amount due in any given month:

```
resolveEffectiveVersion(versions, targetDate)
  → returns the version with the latest effectiveFrom ≤ targetDate
```

This function lives in `@fin/shared/utils/recurring.ts` and is fully unit-tested. The computation is pure — no database call needed once the versions are loaded.

For reporting over a date range (e.g. computing total yearly cost including the price change), use `versionsActiveInRange(versions, from, to)`.

---

## Document Flow

Uploaded documents travel through a strict pipeline before any data affects canonical tables:

```
Upload
  → SourceDocument (stored, checksummed)
      → DocumentExtraction (raw JSON, status: PENDING → COMPLETED | FAILED)
          → ExtractionReview (PENDING → APPROVED | REJECTED)
              → Only on APPROVED: canonical entries created manually by UI
                  IncomeEntry.sourceDocumentId = SourceDocument.id
                  ExpenseEntry.sourceDocumentId = SourceDocument.id
                  DebtPayment.sourceDocumentId = SourceDocument.id
```

**Approving a review does not automatically import data.** The UI must present each extracted item to the owner for individual confirmation before any `IncomeEntry` or `ExpenseEntry` row is created. The `sourceDocumentId` on canonical entries provides the audit trail back to the original file.

The `rawExtractedJson` field on `DocumentExtraction` is treated as untrusted input at all times. It is never used to derive canonical amounts without the review boundary.

---

## Daily Budget Calculation

Daily budget is calendar-day based:

```
dailyBudget = monthlyIncomeArs / daysInMonth(year, month)
```

Weekend-aware budgeting is a future extension — the current model does not redistribute weekend budget to weekdays, but the daily granularity makes it possible to add this without schema changes.

Budget computation is a pure function in `@fin/shared/utils/budget.ts`. The API's `GET /api/v1/budget/daily?date=YYYY-MM-DD` endpoint computes this on-the-fly from the current month's `MonthlyIncomePlan` plus actual `ExpenseEntry` rows for that day.

---

## What Is Intentionally Deferred

| Topic | Why deferred |
|---|---|
| Projection / forecasting | Needs stable expense history first |
| Weekend-aware budget redistribution | Additive to current model, not urgent |
| Live FX market quotes | Requires external API integration and rate selection UX |
| Per-transaction FX override | Schema is ready (fxSnapshotId is nullable); UI not built |
| Document upload pipeline | Requires storage backend decision (S3/local/VPS path) |
| OCR / CSV parsing | Requires upload pipeline first |
| Item-level extraction review | Currently at extraction level; item-level is additive |
| Achievement / badge system | Not core to financial accuracy |
| Multi-user support | Owner allowlist is the only gate; schema is ready |
| Background jobs | No queue needed until document processing is wired |
