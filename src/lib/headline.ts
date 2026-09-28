type M = { name: string; status: string };
type I = { title: string; severity: string };

/** The one sentence at the top of the status page, and the swatch beside it. */
export function headline(monitors: M[], open: I[], maintenanceActive: boolean) {
	const down = monitors.filter((m) => m.status === 'down');
	const slow = monitors.filter((m) => m.status === 'degraded');
	const checked = monitors.filter((m) => m.status !== 'pending' && m.status !== 'paused');
	const healthy = monitors.filter((m) => m.status === 'up' || m.status === 'maintenance').length;
	const worst = down.length ? 'down' : slow.length ? 'degraded' : maintenanceActive ? 'maintenance' : 'up';
	const incident = [...open].sort((a, b) => (a.severity === 'down' ? -1 : 0) - (b.severity === 'down' ? -1 : 0))[0];

	let title: string;
	if (incident) title = incident.title;
	else if (down.length === 1) title = `${down[0].name} is down`;
	else if (down.length > 1) title = `${down.length} services are down`;
	else if (slow.length === 1) title = `${slow[0].name} is responding slowly`;
	else if (slow.length > 1) title = `${slow.length} services are slow`;
	else if (maintenanceActive) title = 'Scheduled maintenance in progress';
	else if (!monitors.length) title = 'Nothing to report yet';
	else if (!checked.length) title = 'Waiting for the first checks';
	else title = 'All systems operational';

	const troubled = down.length + slow.length;
	const sub =
		troubled && monitors.length > troubled
			? `Everything else is operational. ${healthy} of ${monitors.length} services are healthy.`
			: '';
	return { title, sub, status: worst };
}
