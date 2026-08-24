INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'manual',
  'editorial_override',
  'Series Hub Manual Override',
  NULL,
  'high',
  1
);

CREATE INDEX IF NOT EXISTS idx_aliases_preference
  ON title_aliases(show_id, season_id, locale, region, is_preferred DESC, source_key, updated_at DESC);

CREATE VIEW IF NOT EXISTS preferred_show_titles AS
WITH ranked AS (
  SELECT
    ta.id,
    ta.show_id,
    ta.locale,
    ta.region,
    ta.title,
    ta.source_key,
    ta.is_preferred,
    ta.confidence,
    ta.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY ta.show_id, ta.locale, ta.region
      ORDER BY
        CASE
          WHEN ta.source_key = 'manual' AND ta.is_preferred = 1 THEN 0
          WHEN ta.is_preferred = 1 THEN 1
          WHEN ta.source_key = 'manual' THEN 2
          ELSE 3
        END ASC,
        CASE ta.confidence
          WHEN 'official' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'unverified' THEN 3
          ELSE 4
        END ASC,
        ta.updated_at DESC,
        ta.id DESC
    ) AS alias_rank
  FROM title_aliases ta
  WHERE ta.season_id IS NULL
)
SELECT
  show_id,
  MAX(CASE WHEN locale = 'zh' AND region = 'HK' AND alias_rank = 1 THEN title END) AS title_zh_hk,
  MAX(CASE WHEN locale = 'zh' AND region = 'HK' AND alias_rank = 1 THEN source_key END) AS title_zh_hk_source,
  MAX(CASE WHEN locale = 'zh' AND region = 'HK' AND alias_rank = 1 THEN confidence END) AS title_zh_hk_confidence,
  MAX(CASE WHEN locale = 'zh' AND region = 'TW' AND alias_rank = 1 THEN title END) AS title_zh_tw,
  MAX(CASE WHEN locale = 'zh' AND region = 'TW' AND alias_rank = 1 THEN source_key END) AS title_zh_tw_source,
  MAX(CASE WHEN locale = 'zh' AND region = 'TW' AND alias_rank = 1 THEN confidence END) AS title_zh_tw_confidence,
  MAX(CASE WHEN locale = 'zh' AND region = 'CN' AND alias_rank = 1 THEN title END) AS title_zh_cn,
  MAX(CASE WHEN locale = 'zh' AND region = 'CN' AND alias_rank = 1 THEN source_key END) AS title_zh_cn_source,
  MAX(CASE WHEN locale = 'zh' AND region = 'CN' AND alias_rank = 1 THEN confidence END) AS title_zh_cn_confidence
FROM ranked
WHERE alias_rank = 1
GROUP BY show_id;
