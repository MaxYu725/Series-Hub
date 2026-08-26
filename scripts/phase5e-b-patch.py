from pathlib import Path


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new.strip().splitlines()[0] in text:
        return text
    raise SystemExit(f"{label} anchor not found")


tmdb = Path("src/tmdb.js")
text = tmdb.read_text()

old = '''export function selectRoundRobinCandidates(feeds, limit = TMDB_SYNC_BUDGET.detailRequests) {
  const sourceLists = (feeds || []).map((feed) => (Array.isArray(feed) ? feed : []));
  const cursors = sourceLists.map(() => 0);
'''
new = '''export function candidateRotationOffset(
  feeds,
  limit = TMDB_SYNC_BUDGET.detailRequests,
  now = new Date()
) {
  const sourceLists = (feeds || []).filter((feed) => Array.isArray(feed) && feed.length > 0);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const activeFeedCount = Math.max(1, sourceLists.length);
  const stride = Math.max(1, Math.floor(safeLimit / activeFeedCount));
  const maxFeedLength = sourceLists.reduce((max, feed) => Math.max(max, feed.length), 0);
  const rotationSlots = Math.max(1, Math.ceil(maxFeedLength / stride));
  const timestamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now.getTime()
    : Date.now();
  const sixHourSlot = Math.floor(timestamp / (6 * 60 * 60 * 1000));
  return (sixHourSlot % rotationSlots) * stride;
}

export function selectRoundRobinCandidates(
  feeds,
  limit = TMDB_SYNC_BUDGET.detailRequests,
  offset = 0
) {
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  const sourceLists = (feeds || []).map((feed) => {
    if (!Array.isArray(feed) || feed.length === 0) return [];
    const start = safeOffset % feed.length;
    return start === 0 ? [...feed] : [...feed.slice(start), ...feed.slice(0, start)];
  });
  const cursors = sourceLists.map(() => 0);
'''
text = replace_once(text, old, new, "candidate selector")

old = "    const selectedCandidates = selectRoundRobinCandidates(candidateFeeds, detailLimit);\n"
new = '''    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffset
    );
'''
text = replace_once(text, old, new, "sync selector")

old = "      recordsSelected: selectedCandidates.length,\n      recordsChanged,\n"
new = "      recordsSelected: selectedCandidates.length,\n      candidateOffset,\n      recordsChanged,\n"
text = replace_once(text, old, new, "sync result")

tmdb.write_text(text)

test_file = Path("test/phase1b-policy.test.js")
test_text = test_file.read_text()
if "  candidateRotationOffset,\n" not in test_text:
    test_text = test_text.replace(
        "  TMDB_SYNC_BUDGET,\n",
        "  TMDB_SYNC_BUDGET,\n  candidateRotationOffset,\n",
        1,
    )

if "candidate rotation advances page-one slices across six-hour sync slots" not in test_text:
    test_text += '''

test("candidate rotation advances page-one slices across six-hour sync slots", () => {
  const feeds = Array.from({ length: 8 }, (_, feedIndex) =>
    Array.from({ length: 20 }, (_, itemIndex) => ({ id: feedIndex * 100 + itemIndex }))
  );
  const offsets = [0, 6, 12, 18].map((hour) =>
    candidateRotationOffset(
      feeds,
      40,
      new Date(`2026-08-24T${String(hour).padStart(2, "0")}:00:00Z`)
    )
  );

  assert.equal(new Set(offsets).size, 4);
  assert.deepEqual([...offsets].sort((a, b) => a - b), [0, 5, 10, 15]);
});

test("round-robin rotation starts from the requested feed offset and wraps safely", () => {
  const feeds = [
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    [{ id: 10 }, { id: 11 }, { id: 12 }],
    [{ id: 20 }, { id: 21 }, { id: 22 }]
  ];

  assert.deepEqual(
    selectRoundRobinCandidates(feeds, 6, 1).map((item) => item.id),
    [2, 11, 21, 3, 12, 22]
  );
});
'''

test_file.write_text(test_text)
