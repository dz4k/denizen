#!/usr/bin/env -S deno run -A --unstable
import { app } from '../lib/denizen.ts'
Deno.serve({
	hostname: '0.0.0.0',
	port: Deno.env.has('PORT') ? Number(Deno.env.get('PORT')) : undefined,
}, app.fetch)
