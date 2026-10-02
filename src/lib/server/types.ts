export interface BonkEnv {
	DB: D1Database;
	ADMIN_PASSWORD?: string;
	ENCRYPTION_KEY?: string;
	CF_TEAM_DOMAIN?: string;
	CF_AUD_TOKEN?: string;
}

export type MonitorType = 'http' | 'keyword' | 'json' | 'tcp' | 'dns' | 'push';
export type CheckResult = 'up' | 'degraded' | 'down';
export type Status = CheckResult | 'pending';

export interface Monitor {
	id: number;
	name: string;
	type: MonitorType;
	target: string;
	method: string;
	headers: string;
	body: string | null;
	expected_status: string;
	follow_redirects: number;
	keyword: string | null;
	keyword_invert: number;
	json_path: string | null;
	json_expected: string | null;
	dns_type: string;
	dns_expected: string | null;
	push_token: string | null;
	interval_s: number;
	timeout_ms: number;
	slow_ms: number | null;
	alert_after: number;
	resend_min: number;
	paused: number;
	/** Name used on status pages and in incident titles, when the real one shouldn't be shown. */
	public_name: string | null;
	created_at: number;
}

export interface MonitorState {
	monitor_id: number;
	status: Status;
	since: number | null;
	streak_status: CheckResult | null;
	streak: number;
	last_check_at: number | null;
	last_latency: number | null;
	last_message: string | null;
	last_push_at: number | null;
	last_notified_at: number | null;
	incident_id: number | null;
	recent: string;
	h_start: number | null;
	h_n: number;
	h_up: number;
	h_deg: number;
	h_down: number;
	h_lat_sum: number;
	h_lat_n: number;
	h_lat_max: number;
}

export interface Incident {
	id: number;
	monitor_id: number | null;
	title: string;
	severity: 'down' | 'degraded' | 'info';
	status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
	auto: number;
	/** 0 hides it from every status page. Which pages show it follows its monitor, or incident_pages without one. */
	public: number;
	started_at: number;
	resolved_at: number | null;
}

export interface IncidentUpdate {
	id: number;
	incident_id: number;
	ts: number;
	status: string;
	body: string;
}

export interface Channel {
	id: number;
	name: string;
	provider: string;
	config: string;
	default_on: number;
	created_at: number;
}

export interface Maintenance {
	id: number;
	title: string;
	body: string;
	starts_at: number;
	ends_at: number;
	monitor_ids: string;
}
