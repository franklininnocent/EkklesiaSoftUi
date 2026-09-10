# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subscription/expired-tenant-read-only.spec.ts >> Grace period tenant remains writable >> grace tenant snapshot is GRACE_PERIOD with full access
- Location: e2e/subscription/expired-tenant-read-only.spec.ts:123:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at /tmp/cursor-sandbox-cache/8d6fd1f285eb05cb7eaeef64e112532b/playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```