import assert from 'node:assert/strict';
import { resolveAiConfig } from '../../src/config/ai.config';
import { AiService, buildPiiSafeCandidatePromptData } from '../../src/services/ai/ai.service';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingService,
  toPgVectorLiteral,
} from '../../src/services/vector/embedding.service';
import {
  buildSafeTsQuery,
  combineFtsBranchHits,
  mergeHybridCandidateRanks,
} from '../../src/services/vector/pgvectorStore.adapter';
import {
  buildCandidateChunks,
  buildRequirementSearchQuery,
  scrubChunkPiiAndRates,
} from '../../src/services/vector/resumeChunker';

export const runPgvectorRagTests = async () => {
  console.log('--- Running pgvector Hybrid RAG & Chunking Tests ---');

  // 1. Multi-page resume chunker splits deep CVs and scrubs PII/rates
  const deepResume = [
    'Page 1 Summary: Senior Solutions Architect specializing in enterprise cloud migrations. Contact: john.doe@secret.com or +1 (512) 555-8899. Target bill rate $145/hr C2C.',
    '',
    ...Array.from(
      { length: 8 },
      (_, idx) =>
        `Project Experience Block ${idx + 1}: Architected multi-region Kubernetes clusters on AWS EKS with Terraform, Kafka event streaming, Prometheus observability, and automated CI/CD GitHub Actions pipelines across regulated banking workloads. Rate discussed at $120/hr W2.`
    ),
    '',
    'Page 5 Rare Achievement: Led SAP S/4HANA LTMC data migration cockpit rollout and SOX/SOC2 audit controls for 40+ microservices.',
  ].join('\n\n');

  const chunks = buildCandidateChunks({
    currentTitle: 'Principal Cloud & AI Platform Architect',
    skillset: 'AWS, Kubernetes, Terraform, Kafka',
    workAuth: 'US Citizen',
    education: 'MS Computer Science',
    relocation: 'Yes',
    rawSnippet: deepResume,
  });

  assert.ok(chunks.length >= 3, `Expected multiple overlapping chunks for deep CV, got ${chunks.length}`);
  assert.equal(chunks[0].sectionType, 'PROFILE');
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks.some((c) => c.chunkText.includes('SAP S/4HANA LTMC')));

  for (const chunk of chunks) {
    assert.equal(chunk.chunkText.includes('john.doe@secret.com'), false);
    assert.equal(chunk.chunkText.includes('555-8899'), false);
    assert.equal(chunk.chunkText.includes('$145'), false);
    assert.equal(chunk.chunkText.includes('$120'), false);
    assert.match(chunk.contentHash, /^[a-f0-9]{64}$/);
  }

  // Deterministic hash stability
  const chunksAgain = buildCandidateChunks({
    currentTitle: 'Principal Cloud & AI Platform Architect',
    skillset: 'AWS, Kubernetes, Terraform, Kafka',
    workAuth: 'US Citizen',
    education: 'MS Computer Science',
    relocation: 'Yes',
    rawSnippet: deepResume,
  });
  assert.equal(chunks[0].contentHash, chunksAgain[0].contentHash);

  // 2. Scrubbing helper handles inline emails, phones, and rate bands
  const scrubbed = scrubChunkPiiAndRates(
    'Reach me at test.user@domain.org or 408-555-1212; expected pay rate $95/hr W2.'
  );
  assert.equal(scrubbed.includes('test.user@domain.org'), false);
  assert.equal(scrubbed.includes('555-1212'), false);
  assert.equal(scrubbed.includes('$95'), false);

  // 3. TSQuery sanitizer converts punctuation-heavy skills safely
  const safeTs = buildSafeTsQuery(['C#', '.NET Core', 'CI/CD', 'SAP S/4HANA', 'AWS'], '');
  assert.ok(safeTs.includes('aws'));
  assert.ok(safeTs.includes('sap'));
  assert.equal(/[#./]/.test(safeTs), false);

  // 4. Requirement query builder extracts clean non-HTML prompt & skill tokens
  const reqQuery = buildRequirementSearchQuery({
    opportunityTitle: 'Lead AI Platform Engineer',
    skillsRequired: 'Azure, Kubernetes, Python, Azure, CI/CD',
    workModel: 'Hybrid',
    location: 'Chicago, IL',
    publicDescription: '<p>Build <strong>GenAI pipelines</strong> on AKS.</p>',
  });
  assert.equal(reqQuery.skillTokens.length, 4);
  assert.ok(reqQuery.queryText.includes('GenAI pipelines'));
  assert.equal(reqQuery.queryText.includes('<strong>'), false);

  // 5. Hybrid RRF fusion promotes candidates strong in semantic vector matches and preserves excerpts
  const rrf = mergeHybridCandidateRanks({
    ftsHits: [
      { candidateId: 'cand-kw-only', chunkIndex: 0, chunkText: 'AWS mention', score: 0.9 },
      { candidateId: 'cand-both', chunkIndex: 1, chunkText: 'Built Kubernetes clusters', score: 0.7 },
    ],
    vectorHits: [
      {
        candidateId: 'cand-both',
        chunkIndex: 2,
        chunkText: 'Led multi-cluster AKS & EKS orchestration in production',
        similarity: 0.92,
      },
      {
        candidateId: 'cand-semantic',
        chunkIndex: 4,
        chunkText: 'Page 4 container platform automation and Helm pipelines',
        similarity: 0.89,
      },
    ],
    limit: 10,
  });

  assert.equal(rrf[0].candidateId, 'cand-both');
  assert.ok(rrf[0].matchedChunks.some((t) => t.includes('AKS & EKS orchestration')));
  assert.ok(rrf.some((m) => m.candidateId === 'cand-semantic'));

  // 6. EmbeddingService L2-normalizes 768-dim OpenAI & Gemini vectors cleanly
  const unitVec768 = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 3 : i === 1 ? 4 : 0));
  const openaiEmbedSvc = new EmbeddingService(async (_url, init) => {
    const parsedBody = JSON.parse(String(init?.body || '{}'));
    assert.equal(parsedBody.dimensions, EMBEDDING_DIMENSIONS);
    return new Response(
      JSON.stringify({
        model: 'text-embedding-3-small',
        data: [{ index: 0, embedding: unitVec768 }],
        usage: { prompt_tokens: 18 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  const openaiRes = await openaiEmbedSvc.embedTexts(['Kubernetes Architect'], {
    configOverride: resolveAiConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
  });
  assert.ok(openaiRes);
  assert.equal(openaiRes.vectors[0].length, 768);
  assert.ok(Math.abs(openaiRes.vectors[0][0] - 0.6) < 1e-6);
  assert.ok(Math.abs(openaiRes.vectors[0][1] - 0.8) < 1e-6);

  const pgLit = toPgVectorLiteral(openaiRes.vectors[0]);
  assert.ok(pgLit.startsWith('[0.6,0.8,'));

  // 7. Retrieved deep chunks flow into LLM ranking context safely with rate masking
  const promptData = buildPiiSafeCandidatePromptData(
    {
      id: 'c-deep',
      currentTitle: 'AI Engineer',
      skillset: 'Python, AWS',
      rawSnippet: 'Short top intro',
      matchedChunks: ['Deep page 4 project: Built RAG on pgvector; rate $135/hr W2.'],
    },
    { rateMasked: true, maxSnippetChars: 1200 }
  );
  assert.ok(String(promptData.resumeSummaryExcerpt).includes('Deep page 4 project'));
  assert.equal(String(promptData.resumeSummaryExcerpt).includes('135'), false);

  // 8. Dual FTS combiner boosts dual-match candidates and deduplicates multi-chunk dominance
  const combinedFts = combineFtsBranchHits(
    [
      { candidateId: 'c-profile-only', chunkIndex: -1, chunkText: '', score: 0.9 },
      { candidateId: 'c-both', chunkIndex: -1, chunkText: '', score: 0.8 },
    ],
    [
      { candidateId: 'c-both', chunkIndex: 1, chunkText: 'Built Kubernetes clusters', score: 0.6 },
      { candidateId: 'c-both', chunkIndex: 2, chunkText: 'Managed Helm charts', score: 0.5 },
      { candidateId: 'c-chunk-only', chunkIndex: 0, chunkText: 'Kubernetes operator experience', score: 1.0 },
    ]
  );
  assert.equal(combinedFts[0].candidateId, 'c-both');
  assert.ok(combinedFts[0].score > 1.3);
  assert.equal(combinedFts.some((h) => h.candidateId === 'c-chunk-only'), true);

  // 9. Provider limit and auth failures emit clean SaaS copy without leaking API keys or Settings hints
  const neuronsExhaustedAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'cloudflare',
        CLOUDFLARE_AI_ACCOUNT_ID: 'acct-1',
        CLOUDFLARE_AI_API_TOKEN: 'cf-tok',
        AI_FALLBACK_TO_OFFLINE: 'false',
      }),
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          errors: [
            { code: 4006, message: 'You have used up your daily free allocation of 10,000 Neurons.' },
          ],
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      ),
  });

  await assert.rejects(
    () =>
      neuronsExhaustedAi.rankCandidatesForRequirement(
        [{ id: 'c1', currentTitle: 'DevOps', skillset: 'AWS, Kubernetes' }],
        { opportunityTitle: 'DevOps', skillsRequired: 'AWS, Kubernetes' }
      ),
    (err: any) => {
      assert.equal(err?.statusCode, 429);
      assert.match(String(err?.message || ''), /reached its limit/i);
      assert.equal(/switch keys|api key|upgrade|settings/i.test(String(err?.message || '')), false);
      return true;
    }
  );

  const authFailedAi = new AiService({
    getConfig: () =>
      resolveAiConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-bad',
        AI_FALLBACK_TO_OFFLINE: 'false',
      }),
    fetchImpl: async () => new Response('{"error":"Incorrect API key provided"}', { status: 401 }),
  });

  await assert.rejects(
    () =>
      authFailedAi.evaluateSubmissionCapability(
        { id: 'c1', currentTitle: 'DevOps', skillset: 'AWS' },
        { opportunityTitle: 'DevOps', skillsRequired: 'AWS' }
      ),
    (err: any) => {
      // Never return 401 (which triggers JWT logout) or expose API key messages
      assert.equal(err?.statusCode, 503);
      assert.match(String(err?.message || ''), /temporarily unavailable/i);
      assert.equal(/api key|settings/i.test(String(err?.message || '')), false);
      return true;
    }
  );

  console.log('✅ pgvector Hybrid RAG & Chunking Tests: PASSED');
};
