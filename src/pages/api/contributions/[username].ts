import type { APIRoute } from 'astro';

export const prerender = false;

const DEFAULT_CACHE_TTL = Number(process.env.CONTRIBS_CACHE_TTL ?? 300); // seconds
const ERROR_CACHE_TTL = 30; // seconds for transient upstream errors

type CacheEntry = {
	body: unknown;
	status: number;
	createdAt: number;
	expiresAt: number;
};

const contributionCache = new Map<string, CacheEntry>();

const createErrorResponse = (status: number, message: string, source?: string) =>
	new Response(
		JSON.stringify({ error: message, status, source }),
		{
			status,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': `public, max-age=0, s-maxage=${ERROR_CACHE_TTL}, stale-while-revalidate=30`,
			},
		},
	);

const createSuccessResponse = (data: unknown, ttl = DEFAULT_CACHE_TTL) =>
	new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=60`,
		},
	});

const isValidUsername = (username: string) => {
	const ch = username.toLowerCase();
	return /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(ch);
};

export const GET: APIRoute = async ({ params }) => {
	const usernameRaw = String(params.username ?? '').trim();
	if (!usernameRaw) {
		return createErrorResponse(400, 'Username is required');
	}

	const username = usernameRaw.toLowerCase();
	if (!isValidUsername(username)) {
		return createErrorResponse(400, 'Invalid GitHub username format');
	}

	const now = Date.now();
	const cached = contributionCache.get(username);
	if (cached && cached.expiresAt > now) {
		return createSuccessResponse(cached.body, Math.round((cached.expiresAt - now) / 1000));
	}

	const upstreamUrl = `https://github.com/${encodeURIComponent(username)}.contribs`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000); // 10s

	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
		};

		if (process.env.GITHUB_TOKEN) {
			headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}

		const response = await fetch(upstreamUrl, {
			signal: controller.signal,
			headers,
		});

		if (!response.ok) {
			if (response.status === 404) {
				contributionCache.set(username, {
					body: { message: 'User not found' },
					status: 404,
					createdAt: now,
					expiresAt: now + ERROR_CACHE_TTL * 1000,
				});
				return createErrorResponse(404, 'GitHub user not found', upstreamUrl);
			}

			const errorBody = { message: `Upstream error: ${response.status}` };
			contributionCache.set(username, {
				body: errorBody,
				status: response.status,
				createdAt: now,
				expiresAt: now + ERROR_CACHE_TTL * 1000,
			});
			return createErrorResponse(502, 'Failed to fetch contributions', upstreamUrl);
		}

		const body = await response.json();
		const ttl = DEFAULT_CACHE_TTL;
		contributionCache.set(username, {
			body,
			status: 200,
			createdAt: now,
			expiresAt: now + ttl * 1000,
		});

		return createSuccessResponse(body, ttl);
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return createErrorResponse(504, 'Upstream request timed out', upstreamUrl);
		}
		console.error('Contrib proxy error', { username, upstreamUrl, error });
		return createErrorResponse(500, 'Internal server error');
	} finally {
		clearTimeout(timeout);
	}
};
