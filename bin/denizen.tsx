#!/usr/bin/env -S deno run -A --unstable
import { app } from '../lib/server.tsx'
Deno.serve(app.fetch)
