export type MonitorStatus = 'up' | 'degraded' | 'down';

/** What happened, independent of how any one service formats it. */
export interface Alert {
	kind: 'down' | 'degraded' | 'up' | 'reminder' | 'test';
	monitor: {
		id: number;
		name: string;
		/** URL, host:port, hostname or "push" — shown verbatim. */
		target: string;
	};
	/** Status before and after the change. Equal for reminders. */
	from: MonitorStatus | 'pending';
	to: MonitorStatus;
	/** One line on why, e.g. "HTTP 502 Bad Gateway" or "1,712 ms (slow above 1,500 ms)". */
	reason: string;
	/** Seconds since epoch. */
	at: number;
	/** How long the previous state lasted, in seconds, when known (set on recovery). */
	downFor?: number;
	/** Absolute link to the monitor in the admin, when the site URL is known. */
	link?: string;
	/** Name of this Bonk instance (e.g. "gege status"). */
	siteName: string;
}

export type FieldType = 'text' | 'url' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';

export interface Field {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	/** Stored encrypted and never sent back to the browser. */
	secret?: boolean;
	placeholder?: string;
	help?: string;
	options?: { value: string; label: string }[];
	default?: string | boolean;
}

export type ProviderConfig = Record<string, string | boolean | undefined>;

export interface Provider {
	id: string;
	name: string;
	/** Two-letter monogram for the UI tile. */
	mono: string;
	/** Short grouping for the picker: chat, push, email, incident, webhook. */
	category: 'chat' | 'push' | 'email' | 'incident' | 'webhook';
	/** Link to the provider's own setup docs. */
	docs?: string;
	fields: Field[];
	/** Throws on failure; the message becomes the event log / retry error. */
	send(config: ProviderConfig, alert: Alert): Promise<void>;
}
