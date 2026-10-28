import http from 'node:http';

// adapter-node assumes TLS termination and falls back to `https://` when no
// protocol header is present. Daybook is normally served directly over plain
// HTTP on the LAN, so default the forwarded protocol to http unless a reverse
// proxy in front of us says otherwise (e.g. Tailscale Serve, Caddy, nginx).
process.env.PROTOCOL_HEADER = process.env.PROTOCOL_HEADER || 'x-forwarded-proto';

const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
	if (!req.headers['x-forwarded-proto']) {
		req.headers['x-forwarded-proto'] = 'http';
	}
	handler(req, res);
});

server.listen(port, host, () => {
	console.log(`Daybook listening on http://${host}:${port}`);
});
