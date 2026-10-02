-- Status pages: each one picks its monitors and has its own name, links, theme and visibility.

CREATE TABLE pages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- URL segment. The default page is served at /, and its slug only redirects there.
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	-- JSON array of { label, href } header links.
	links TEXT NOT NULL DEFAULT '[]',
	-- 0 puts the page behind the admin sign-in.
	public INTEGER NOT NULL DEFAULT 1,
	is_default INTEGER NOT NULL DEFAULT 0,
	-- JSON theme and logo; NULL follows the site's (Admin → Settings → Appearance).
	theme TEXT,
	logo TEXT,
	logo_version INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX pages_one_default ON pages (is_default) WHERE is_default = 1;

-- A monitor can be on several pages or none; alerts don't depend on this.
CREATE TABLE page_monitors (
	page_id INTEGER NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
	monitor_id INTEGER NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
	group_name TEXT NOT NULL DEFAULT '',
	sort INTEGER NOT NULL DEFAULT 0,
	-- NULL falls back to the monitor's public name, then its name.
	display_name TEXT,
	PRIMARY KEY (page_id, monitor_id)
) WITHOUT ROWID;
CREATE INDEX page_monitors_monitor ON page_monitors (monitor_id);

-- Pins an incident to a page. One with a monitor also appears wherever that monitor does;
-- one without (a general notice, or history kept from a deleted monitor) only shows through these rows.
CREATE TABLE incident_pages (
	incident_id INTEGER NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
	page_id INTEGER NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
	PRIMARY KEY (incident_id, page_id)
) WITHOUT ROWID;

-- The default page takes over what the single status page showed.
INSERT INTO pages (slug, name, description, links, public, is_default, created_at)
VALUES (
	'default',
	coalesce((SELECT nullif(trim(json_extract(value, '$.name')), '') FROM settings WHERE key = 'site'), 'Bonk'),
	coalesce((SELECT json_extract(value, '$.description') FROM settings WHERE key = 'site'), ''),
	coalesce((SELECT json_extract(value, '$.links') FROM settings WHERE key = 'site'), '[]'),
	1,
	1,
	unixepoch()
);

INSERT INTO page_monitors (page_id, monitor_id, group_name, sort)
SELECT (SELECT id FROM pages WHERE is_default = 1), id, group_name, sort FROM monitors WHERE public = 1;

-- Shown incidents that no monitor on the default page would carry: notices, and ones posted about a private monitor.
INSERT INTO incident_pages (incident_id, page_id)
SELECT i.id, (SELECT id FROM pages WHERE is_default = 1)
FROM incidents i LEFT JOIN monitors m ON m.id = i.monitor_id
WHERE i.public = 1 AND (i.monitor_id IS NULL OR m.public = 0);

-- Automatic incidents were hidden only because their monitor was private; pages decide that now.
UPDATE incidents SET public = 1 WHERE auto = 1;

-- monitors.public, group_name and sort are no longer read. They stay for now so the previous Worker keeps
-- running while this migration is applied ahead of the deploy, and so a rollback still finds them.
