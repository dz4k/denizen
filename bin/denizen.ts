#!/usr/bin/env -S deno run -A --unstable
import { app } from '../lib/denizen.ts'
Deno.serve(app.fetch)
