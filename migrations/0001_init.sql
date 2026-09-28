-- Timestamps are unix seconds.

CREATE TABLE monitors (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('http', 'keyword', 'json', 'tcp', 'dns', 'push')),
	-- URL for http/keyword/json, host:port for tcp, hostname for dns, empty for push.
	target TEXT NOT NULL DEFAULT '',
	method TEXT NOT NULL DEFAULT 'GET',
	headers TEXT NOT NULL DEFAULT '{}',
	body TEXT,
	expected_status TEXT NOT NULL DEFAULT '2xx',
	follow_redirects INTEGER NOT NULL DEFAULT 1,
	keyword TEXT,
	keyword_invert INTEGER NOT NULL DEFAULT 0,
	json_path TEXT,
	json_expected TEXT,
	dns_type TEXT NOT NULL DEFAULT 'A',
	dns_expected TEXT,
	push_token TEXT UNIQUE,
	interval_s INTEGER NOT NULL DEFAULT 60,
	timeout_ms INTEGER NOT NULL DEFAULT 10000,
	-- Responses slower than this count as degraded; NULL disables it.
	slow_ms INTEGER,
	-- Consecutive failed checks before the monitor is confirmed down/degraded.
	alert_after INTEGER NOT NULL DEFAULT 3,
	-- Re-alert every N minutes while still failing; 0 = never.
	resend_min INTEGER NOT NULL DEFAULT 0,
	paused INTEGER NOT NULL DEFAULT 0,
	public INTEGER NOT NULL DEFAULT 1,
	public_name TEXT,
	group_name TEXT NOT NULL DEFAULT '',
	sort INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

-- One row per monitor, rewritten on every check. Everything the cron needs lives
-- here so a tick costs one row write per monitor (D1 free tier: 100k writes/day).
CREATE TABLE monitor_state (
	monitor_id INTEGER PRIMARY KEY REFERENCES monitors (id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'pending',
	since INTEGER,
	streak_status TEXT,
	streak INTEGER NOT NULL DEFAULT 0,
	last_check_at INTEGER,
	last_latency INTEGER,
	last_message TEXT,
	last_push_at INTEGER,
	last_notified_at INTEGER,
	incident_id INTEGER,
	-- Last 90 raw checks, oldest first: "ts:u|d|x:latency;..."
	recent TEXT NOT NULL DEFAULT '',
	-- Running totals for the current hour, flushed into `hourly` when it rolls over.
	h_start INTEGER,
	h_n INTEGER NOT NULL DEFAULT 0,
	h_up INTEGER NOT NULL DEFAULT 0,
	h_deg INTEGER NOT NULL DEFAULT 0,
	h_down INTEGER NOT NULL DEFAULT 0,
	h_lat_sum INTEGER NOT NULL DEFAULT 0,
	h_lat_n INTEGER NOT NULL DEFAULT 0,
	h_lat_max INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE hourly (
	monitor_id INTEGER NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
	hour INTEGER NOT NULL,
	n INTEGER NOT NULL,
	up INTEGER NOT NULL,
	deg INTEGER NOT NULL,
	down INTEGER NOT NULL,
	lat_sum INTEGER NOT NULL,
	lat_n INTEGER NOT NULL,
	lat_max INTEGER NOT NULL,
	PRIMARY KEY (monitor_id, hour)
) WITHOUT ROWID;

CREATE TABLE daily (
	monitor_id INTEGER NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
	day INTEGER NOT NULL,
	n INTEGER NOT NULL,
	up INTEGER NOT NULL,
	deg INTEGER NOT NULL,
	down INTEGER NOT NULL,
	lat_sum INTEGER NOT NULL,
	lat_n INTEGER NOT NULL,
	PRIMARY KEY (monitor_id, day)
) WITHOUT ROWID;

CREATE TABLE events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	monitor_id INTEGER REFERENCES monitors (id) ON DELETE CASCADE,
	ts INTEGER NOT NULL,
	kind TEXT NOT NULL,
	message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX events_monitor_ts ON events (monitor_id, ts DESC);

CREATE TABLE incidents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	monitor_id INTEGER REFERENCES monitors (id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	severity TEXT NOT NULL DEFAULT 'down' CHECK (severity IN ('down', 'degraded', 'info')),
	status TEXT NOT NULL DEFAULT 'investigating'
		CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
	auto INTEGER NOT NULL DEFAULT 0,
	public INTEGER NOT NULL DEFAULT 1,
	started_at INTEGER NOT NULL,
	resolved_at INTEGER
);
CREATE INDEX incidents_started ON incidents (started_at DESC);

CREATE TABLE incident_updates (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	incident_id INTEGER NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
	ts INTEGER NOT NULL,
	status TEXT NOT NULL,
	body TEXT NOT NULL
);
CREATE INDEX incident_updates_incident ON incident_updates (incident_id, ts DESC);

CREATE TABLE channels (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	provider TEXT NOT NULL,
	-- JSON; secret fields are encrypted individually (see crypto.ts).
	config TEXT NOT NULL DEFAULT '{}',
	default_on INTEGER NOT NULL DEFAULT 1,
	created_at INTEGER NOT NULL
);

CREATE TABLE monitor_channels (
	monitor_id INTEGER NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
	channel_id INTEGER NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
	PRIMARY KEY (monitor_id, channel_id)
) WITHOUT ROWID;

CREATE TABLE notify_queue (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	channel_id INTEGER NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
	monitor_id INTEGER,
	alert TEXT NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	next_at INTEGER NOT NULL,
	last_error TEXT
);

CREATE TABLE maintenance (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	body TEXT NOT NULL DEFAULT '',
	starts_at INTEGER NOT NULL,
	ends_at INTEGER NOT NULL,
	-- JSON array of monitor ids; empty array = every monitor.
	monitor_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE login_attempts (
	ip TEXT NOT NULL,
	ts INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_ts ON login_attempts (ip, ts);
