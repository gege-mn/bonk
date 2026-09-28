import type { Alert, Provider, ProviderConfig } from './types';
import apprise from './providers/apprise';
import bark from './providers/bark';
import brevo from './providers/brevo';
import dingtalk from './providers/dingtalk';
import discord from './providers/discord';
import feishu from './providers/feishu';
import googlechat from './providers/googlechat';
import gotify from './providers/gotify';
import homeassistant from './providers/homeassistant';
import line from './providers/line';
import mailgun from './providers/mailgun';
import matrix from './providers/matrix';
import mattermost from './providers/mattermost';
import ntfy from './providers/ntfy';
import opsgenie from './providers/opsgenie';
import pagerduty from './providers/pagerduty';
import postmark from './providers/postmark';
import pushbullet from './providers/pushbullet';
import pushdeer from './providers/pushdeer';
import pushover from './providers/pushover';
import resend from './providers/resend';
import rocketchat from './providers/rocketchat';
import sendgrid from './providers/sendgrid';
import serverchan from './providers/serverchan';
import signal from './providers/signal';
import slack from './providers/slack';
import smtp2go from './providers/smtp2go';
import splunk from './providers/splunk';
import teams from './providers/teams';
import telegram from './providers/telegram';
import twilio from './providers/twilio';
import webex from './providers/webex';
import webhook from './providers/webhook';
import wecom from './providers/wecom';
import zulip from './providers/zulip';

const PINNED = ['telegram', 'discord'];

export const providers: Provider[] = [
	apprise,
	bark,
	brevo,
	dingtalk,
	discord,
	feishu,
	googlechat,
	gotify,
	homeassistant,
	line,
	mailgun,
	matrix,
	mattermost,
	ntfy,
	opsgenie,
	pagerduty,
	postmark,
	pushbullet,
	pushdeer,
	pushover,
	resend,
	rocketchat,
	sendgrid,
	serverchan,
	signal,
	slack,
	smtp2go,
	splunk,
	teams,
	telegram,
	twilio,
	webex,
	webhook,
	wecom,
	zulip
].sort((a, b) => {
	const pa = PINNED.indexOf(a.id);
	const pb = PINNED.indexOf(b.id);
	if (pa !== -1 || pb !== -1) return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb);
	return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
});

const byId = new Map(providers.map((p) => [p.id, p]));

export function getProvider(id: string): Provider | undefined {
	return byId.get(id);
}

export async function sendAlert(providerId: string, config: ProviderConfig, alert: Alert): Promise<void> {
	const provider = getProvider(providerId);
	if (!provider) throw new Error(`Unknown notification provider "${providerId}"`);
	await provider.send(config, alert);
}

export type { Alert, Field, Provider, ProviderConfig } from './types';
