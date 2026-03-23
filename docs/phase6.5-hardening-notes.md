# Phase 6.5 Hardening Notes

Focused stabilization pass on the Phase 6 agent layer.

## A. Role Boundary Tightening

Each agent spec now includes a `boundaryInstruction` that explicitly tells the agent what it must NOT discuss:

- **Mark**: "Do NOT discuss basket composition, portfolio risk, or recommend specific actions. That is Paul's and Rex's job."
- **Nia**: "Do NOT assign opportunity scores, suggest trades, or evaluate basket risk. That belongs to Mark, Rex, and Paul."
- **Paul**: "Do NOT scout opportunities, rate individual setups, or recommend specific trade actions. That belongs to Mark and Rex."
- **Rex**: "Do NOT analyze market narratives, scout new opportunities, or assess overall basket composition. That belongs to Nia, Mark, and Paul."

System prompt structure is now: `systemPrompt + boundaryInstruction + outputInstruction`.

## B. Prompt Versioning

- `PROMPT_VERSION` constant (`1.1`) in `contracts.ts` — increment when prompts change materially
- Prompt key format changed to `{key}@{version}` (e.g., `mark.ticker_commentary@1.1`)
- Version persisted in both `agent_briefs.prompt_key` and `raw_llm_outputs.prompt_key`
- `prompt_version` field added to `AgentArtifact` interface
- Provenance footer in UI now shows `prompt v1.1`
- Audit trail answer: "which prompt version generated this artifact?" → check prompt_key

## C. Storage Metadata Improvements

`AgentArtifact` now includes:
- `prompt_version` — extracted from prompt_key or constant
- `latency_ms` — actual call duration in milliseconds
- `status` — `'success'` | `'failed'` | `'fallback'`

`raw_llm_outputs.input_data` now includes:
- `prompt_version` — which version of the prompt was used
- `status` — whether the call succeeded

`agent_briefs.structured_output` JSONB now includes:
- `status` — success/failed/fallback
- `latency_ms` — call duration

## D. Fallback Behavior

When LLM fails, the service now:
1. Sets `status = 'failed'`
2. Generates a **meaningful deterministic fallback** per agent:
   - Mark: "XRP scores 71/100. Review the component scores above. Mark's AI assessment is temporarily unavailable."
   - Nia: "Check the catalyst and sentiment scores in the system data above. Nia's narrative assessment is temporarily unavailable."
   - Paul: "Basket analytics are shown above. Paul's deeper review is temporarily unavailable."
   - Rex: "The system action recommendation is shown above. Rex's tactical explanation is temporarily unavailable."
3. Fallback references the system data so users still have useful information
4. Persists the failed artifact for audit trail
5. UI shows "fallback" or "partial" badge instead of blank/crash

When LLM responds but structured parsing fails:
- Sets `status = 'fallback'`
- Uses raw text as content (still useful, just not parsed)
- UI shows "partial" badge

## E. UI Clarity Improvements

### ExplainDrawer changes:
- System Data box now labeled "System Data (deterministic, not AI)"
- Agent narrative labeled with "agent commentary" in italic
- Status badges: green check (success), yellow "partial" (fallback), red "fallback" (failed)
- Provenance footer shows: `model · prompt v1.1 · 342 tokens · 1.2s · 2:15 PM`
- Error state shows: "Agent unavailable" + "System data above remains valid"
- Drivers/risks sections only shown for `status === 'success'` (not for fallback)

### Clear epistemic separation:
1. **System Data** box — deterministic scores, P&L, risk (always available)
2. **Agent narrative** — LLM-generated assessment with stance/confidence
3. Status indicator — user knows if this is a real agent response or fallback

## F. Latency/Cost Instrumentation

Every agent call now captures:
- `latency_ms` — `Date.now()` diff around the Claude call
- `tokens_used` — `input_tokens + output_tokens` from API response
- Both stored in `raw_llm_outputs.duration_ms` and artifact metadata
- UI provenance footer renders: "342 tokens · 1.2s"

## G. Generation Status

Three states:
- `success` — LLM responded, structured output parsed
- `fallback` — LLM responded but output wasn't valid JSON (raw text used)
- `failed` — LLM call threw an error (deterministic fallback used)

Status is:
- Persisted in `agent_briefs.structured_output.status`
- Persisted in `raw_llm_outputs.input_data.status`
- Rendered in UI via colored badges

## What Remains for Phase 7

1. **LangGraph graphs** — replace direct Claude calls with stateful graph workflows
2. **Committee synthesis** — parallel agent graph for multi-perspective briefs
3. **Agent chat** — persistent threaded conversations
4. **`agent` schema** — dedicated schema for threads/messages/graphs
5. **Streaming** — stream agent responses to UI
6. **Prompt A/B testing** — compare prompt versions systematically
7. **Cost dashboards** — aggregate token/latency metrics
