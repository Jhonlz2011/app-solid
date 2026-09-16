/**
 * Master E2E Test Suite Entry Point
 * Covers Tiers 1-4 for Features F1-F20 + Automated Static Checks
 * 100% Type Safe, Non-Browser Execution (Bun Test Runner)
 */

import './static-checks.test';
import './tier1-features.test';
import './tier2-boundary.test';
import './tier3-interactions.test';
import './tier4-workloads.test';
