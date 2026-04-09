# Statement Analysis Design

Use this skill when implementing or reviewing the Claude-based PDF statement extraction feature.

## Architecture

The extraction pipeline lives in `apps/api/src/modules/documents/`:
- **Router**: `documents.router.ts` — handles upload, extraction retrieval, review, import
- **Service**: `documents.service.ts` — orchestrates upload → extract → store
- **Provider interface**: `extraction/types.ts` — `ExtractionProvider`, `ExtractedPayload`
- **Entry point**: `extraction/index.ts` — swap `extractDocument()` for the Claude provider here

The Claude-based provider replaces the removed heuristic extractor. Implement it as a single
new file (e.g. `extraction/claude-provider.ts`) that satisfies `ExtractionProvider`.

## Claude API call

- Send the raw PDF buffer as a `document` content block (base64-encoded), not extracted text
- Model: `claude-haiku-4-5-20251001` (cost-efficient); upgrade to `claude-sonnet-4-6` if accuracy is insufficient
- System prompt: instruct Claude to return a single JSON object matching `ExtractedPayload`
- Parse and validate the response JSON with Zod before returning — Claude's output is untrusted input

```typescript
// Minimal provider shape
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionProvider, ExtractedPayload } from './types.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export const claudeProvider: ExtractionProvider = {
  async extract(buffer: Buffer, mimeType: string, docType: string): Promise<ExtractedPayload> {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [{
          type: 'document',
          source: { type: 'base64', media_type: mimeType as 'application/pdf', data: buffer.toString('base64') },
        }, {
          type: 'text',
          text: `Extract structured data from this ${docType} document. Return only valid JSON matching the ExtractedPayload schema.`,
        }],
      }],
    });
    // Parse, validate with Zod, return
  },
};
```

## ExtractionProvider interface (updated for buffer-first approach)

The interface in `extraction/types.ts` currently takes `(text: string, docType: string)`.
Update it to `(buffer: Buffer, mimeType: string, docType: string)` and update the
`extractDocument()` call site in `documents.service.ts` to match.

## Review boundary — never skip

- `rawExtractedJson` stored in `DocumentExtraction` is UNTRUSTED — treat like user input
- Extraction status set to `COMPLETED` after provider returns; does NOT mean data is clean
- User must APPROVE via `ExtractionReview` before `importExtraction()` is callable
- `importExtraction()` checks for an APPROVED review and throws 422 if absent
- Never auto-import — every extracted item requires explicit user confirmation in the UI

## Env var to add

```
ANTHROPIC_API_KEY=sk-ant-...
```

Add to `apps/api/.env` (local) and document in `apps/api/.env.example`.

## Quality checks

After implementing the provider:
```bash
pnpm --filter @fin/api typecheck
pnpm test
```

The `@anthropic-ai/sdk` package must be added to `apps/api/package.json` dependencies.
