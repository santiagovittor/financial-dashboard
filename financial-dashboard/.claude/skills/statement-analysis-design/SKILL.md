---
name: statement-analysis-design
description: Design and implementation guide for the Gemini-based PDF statement extraction feature. Covers provider interface, Gemini API call pattern, review boundary rules, and quality checks.
---

# Statement Analysis Design

Use this skill when implementing or reviewing the Gemini-based PDF statement extraction feature.

## Architecture

The extraction pipeline lives in `apps/api/src/modules/documents/`:
- **Router**: `documents.router.ts` — handles upload, extraction retrieval, review, import
- **Service**: `documents.service.ts` — orchestrates upload → extract → store
- **Provider interface**: `extraction/types.ts` — `ExtractionProvider`, `ExtractedPayload`
- **Entry point**: `extraction/index.ts` — wire `extractDocument()` to the Gemini provider here

Implement the provider as a single new file (e.g. `extraction/gemini-provider.ts`) that satisfies `ExtractionProvider`.

## Gemini API call

- Use the `@google/generative-ai` SDK (or `@google-cloud/vertexai` if using Vertex AI)
- Pass the raw PDF buffer directly as inline file data — no separate text extraction step
- Model: `gemini-2.0-flash` (cost-efficient); upgrade to `gemini-2.5-pro` if accuracy is insufficient
- Instruct the model to return a single JSON object matching `ExtractedPayload`
- Parse and validate the response with Zod before returning — model output is untrusted input
- If `GEMINI_API_KEY` is missing at startup, throw a clear configuration error rather than failing silently at extract time

```typescript
// Minimal provider shape
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractionProvider, ExtractedPayload } from './types.js';
import { extractedPayloadSchema } from './types.js'; // Zod schema

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set — Gemini extraction provider cannot start');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export const geminiProvider: ExtractionProvider = {
  async extract(buffer: Buffer, mimeType: string, docType: string): Promise<ExtractedPayload> {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType as 'application/pdf',
          data: buffer.toString('base64'),
        },
      },
      `Extract structured data from this ${docType} document. Return only valid JSON matching the ExtractedPayload schema. No markdown, no explanation.`,
    ]);
    const text = result.response.text();
    // Strip markdown code fences if present, then parse + validate
    const json = JSON.parse(text.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim());
    return extractedPayloadSchema.parse(json);
  },
};
```

## ExtractionProvider interface

The interface in `extraction/types.ts` takes `(buffer: Buffer, mimeType: string, docType: string)`.
This is correct for the Gemini provider — no changes needed there.

## Review boundary — never skip

- `rawExtractedJson` stored in `DocumentExtraction` is UNTRUSTED — treat like user input
- Extraction status set to `COMPLETED` after provider returns; does NOT mean data is clean
- User must APPROVE via `ExtractionReview` before `importExtraction()` is callable
- `importExtraction()` checks for an APPROVED review and throws 422 if absent
- Never auto-import — every extracted item requires explicit user confirmation in the UI

## Env var to add

```
GEMINI_API_KEY=your-api-key-here
```

Add to `apps/api/.env` (local) and document in `apps/api/.env.example`.

## Quality checks

After implementing the provider:
```bash
pnpm --filter @fin/api typecheck
pnpm test
```

Add `@google/generative-ai` to `apps/api/package.json` dependencies.
