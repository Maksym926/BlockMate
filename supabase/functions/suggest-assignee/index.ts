// suggest-assignee Edge Function (T6)
// Calls Claude API (claude-haiku-5-5) to pick the fairest assignee for a chore.
// Falls back to rotation by join order if the AI times out or returns invalid data (D-022).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-5-5';
const TIMEOUT_MS = 5000; // D-022: 5s, no retry

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResidentRow {
  id: string;
  display_name: string;
  joined_at: string;
}

interface CompletionRow {
  resident_id: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = await req.json();
    const roomId: string = body.room_id;
    const choreTitle: string = body.chore_title ?? 'a chore';
    const excludeIds: string[] = body.exclude_ids ?? [];
    const lastAssigneeId: string | null = body.last_assignee_id ?? null;

    if (!roomId) return json({ error: 'room_id required' }, 400);

    // ── Load residents ordered by join date ───────────────────────────────
    const { data: residents, error: resErr } = await supabase
      .from('residents')
      .select('id, display_name, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (resErr || !residents || residents.length < 2) {
      return json({ error: 'could not load residents' }, 500);
    }

    const eligible = (residents as ResidentRow[]).filter((r) => !excludeIds.includes(r.id));
    if (eligible.length === 0) return json({ error: 'no eligible residents' }, 400);

    // ── Fairness data: completions in last 30 days (D-010) ────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: completions } = await supabase
      .from('completions')
      .select('resident_id')
      .eq('room_id', roomId)
      .gte('completed_at', thirtyDaysAgo);

    const counts: Record<string, number> = {};
    for (const r of eligible) counts[r.id] = 0;
    for (const c of ((completions ?? []) as CompletionRow[])) {
      if (c.resident_id in counts) counts[c.resident_id]++;
    }

    const now = Date.now();
    const membersWithScores = eligible.map((r) => {
      const days = Math.max(1, Math.floor((now - new Date(r.joined_at).getTime()) / 86_400_000));
      const cappedDays = Math.min(days, 30);
      const completionCount = counts[r.id] ?? 0;
      return { ...r, completionCount, daysSinceJoining: days, score: completionCount / cappedDays };
    });

    // Best candidate by score (deterministic hint for the AI)
    const preCheck = [...membersWithScores].sort((a, b) => a.score - b.score)[0]!;

    // ── Build prompt ──────────────────────────────────────────────────────
    const membersList = membersWithScores
      .map(
        (m) =>
          `- ${m.display_name} (id: ${m.id}): joined ${m.daysSinceJoining} day(s) ago, ` +
          `${m.completionCount} chore(s) in last 30 days, score: ${m.score.toFixed(3)}`,
      )
      .join('\n');

    const prompt =
      `You are helping assign a household chore fairly among flatmates. ` +
      `Pick the person who has done the fewest chores relative to how long they have been in the flat ` +
      `(lower score = less busy). Fairness score = chores in last 30 days / min(days in flat, 30).\n\n` +
      `Chore: "${choreTitle}"\n\n` +
      `Flatmates:\n${membersList}\n\n` +
      `Deterministic pre-check suggests: ${preCheck.display_name} (id: ${preCheck.id})\n\n` +
      `Respond with ONLY a single-line JSON object, no other text:\n` +
      `{"assignee_id": "<resident_id>", "reason": "<one short sentence, e.g. Anna has done the fewest chores this month>"}`;

    // ── Call Claude API (5 s timeout, no retry – D-022) ───────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    let aiResult: { assignee_id: string; reason: string } | null = null;

    if (anthropicKey) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const aiRes = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const rawText: string = aiData?.content?.[0]?.text ?? '';
          const match = rawText.match(/\{[^}]+\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (
              typeof parsed.assignee_id === 'string' &&
              eligible.some((r) => r.id === parsed.assignee_id) &&
              typeof parsed.reason === 'string' &&
              parsed.reason.trim().length > 0
            ) {
              aiResult = parsed;
            }
          }
        }
      } catch {
        clearTimeout(timer);
        // Timeout or network error – fall through to rotation
      }
    }

    if (aiResult) {
      return json({ assignee_id: aiResult.assignee_id, reason: aiResult.reason, source: 'ai' });
    }

    // ── Rotation fallback: next by join order after lastAssigneeId (D-022) ─
    let fallback: ResidentRow;
    if (lastAssigneeId) {
      const lastIdx = eligible.findIndex((r) => r.id === lastAssigneeId);
      fallback = eligible[(lastIdx + 1) % eligible.length]!;
    } else {
      fallback = eligible[0]!;
    }

    return json({ assignee_id: fallback.id, reason: null, source: 'fallback' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
