PRAGMA foreign_keys = ON;

-- Phase 7B expands the verified official lifecycle evidence whitelist across
-- additional major US television groups. Registration alone does not enable
-- automatic collection; evidence remains identity-guarded and editorially ingested.
INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES
  (
    'paramount_press_express',
    'official_press',
    'Paramount Press Express',
    'https://www.paramountpressexpress.com/',
    'official',
    1
  ),
  (
    'nbcuniversal_newsroom',
    'official_press',
    'NBCUniversal Newsroom',
    'https://www.nbcuniversal.com/article/',
    'official',
    1
  ),
  (
    'disney_newsroom',
    'official_press',
    'The Walt Disney Company Newsroom',
    'https://thewaltdisneycompany.com/news/',
    'official',
    1
  ),
  (
    'amc_networks_press',
    'official_press',
    'AMC Networks Press Releases',
    'https://www.amcnetworks.com/press-releases/',
    'official',
    1
  );