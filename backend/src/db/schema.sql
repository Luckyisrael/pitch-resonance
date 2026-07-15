CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL DEFAULT '',
  away_team TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming'
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  seq INTEGER,
  FOREIGN KEY (match_id) REFERENCES matches(match_id)
);

CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, timestamp);

CREATE TABLE IF NOT EXISTS fixture_raw (
  fixture_id TEXT PRIMARY KEY,
  raw_data TEXT NOT NULL,
  home_team TEXT NOT NULL DEFAULT '',
  away_team TEXT NOT NULL DEFAULT '',
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  total_events INTEGER NOT NULL DEFAULT 0,
  match_date TEXT,
  loaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fixture_frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  clock_sec INTEGER NOT NULL,
  pixel_data BLOB,
  possession INTEGER NOT NULL DEFAULT 50,
  ball_x INTEGER NOT NULL DEFAULT 128,
  ball_y INTEGER NOT NULL DEFAULT 128,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  phase INTEGER NOT NULL DEFAULT 1,
  action TEXT,
  team INTEGER,
  FOREIGN KEY (fixture_id) REFERENCES fixture_raw(fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_frames_fixture ON fixture_frames(fixture_id, seq);
CREATE INDEX IF NOT EXISTS idx_frames_clock ON fixture_frames(fixture_id, clock_sec);
