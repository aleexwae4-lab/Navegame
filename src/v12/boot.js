// Stable production entrypoint retained for existing Render configuration.
// V28.0.1 boot is intentionally resilient: premium layers load dynamically and
// a stable V15 core remains available if a later browser-only module fails.
import { bootWithFallback, installBootWatchdog } from '../v28/bootstrap-guard.js';

installBootWatchdog();
bootWithFallback();
