function pad(value) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDateKeyDays(dateKey, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return null;
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + Number(days || 0));
  return parsed.toISOString().slice(0, 10);
}

export function dateKeyInTimeZone(timestamp, timeZone) {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(parsed)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function episodeLocalDateKey(episode, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const timestampKey = dateKeyInTimeZone(episode?.air_timestamp, timeZone);
  if (timestampKey) return timestampKey;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(episode?.air_date || "")) ? episode.air_date : null;
}

export function episodeCode(episode) {
  const season = Number(episode?.season_number);
  const number = Number(episode?.episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(number) || number < 1) return null;
  return `S${pad(season)}E${pad(number)}`;
}

export function scheduleWindow(episodes, startDateKey, days, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const safeDays = Math.max(1, Number(days) || 1);
  const endDateKey = addDateKeyDays(startDateKey, safeDays - 1);
  return (Array.isArray(episodes) ? episodes : [])
    .filter((episode) => {
      const key = episodeLocalDateKey(episode, timeZone);
      return key && key >= startDateKey && key <= endDateKey;
    })
    .sort((left, right) => {
      const leftKey = episodeLocalDateKey(left, timeZone) || "9999-12-31";
      const rightKey = episodeLocalDateKey(right, timeZone) || "9999-12-31";
      const dateCompare = leftKey.localeCompare(rightKey);
      if (dateCompare) return dateCompare;

      const leftStamp = left.air_timestamp ? Date.parse(left.air_timestamp) : Number.POSITIVE_INFINITY;
      const rightStamp = right.air_timestamp ? Date.parse(right.air_timestamp) : Number.POSITIVE_INFINITY;
      if (leftStamp !== rightStamp) return leftStamp - rightStamp;

      const timeCompare = String(left.air_time || "99:99").localeCompare(String(right.air_time || "99:99"));
      if (timeCompare) return timeCompare;
      return String(left.english_title || left.original_title || "").localeCompare(String(right.english_title || right.original_title || ""));
    });
}
