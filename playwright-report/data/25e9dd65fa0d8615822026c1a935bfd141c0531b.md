# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subscription/expired-tenant-renewal.spec.ts >> Expired tenant renewal restores write access >> platform renew allows parish mutation without re-login
- Location: e2e/subscription/expired-tenant-renewal.spec.ts:19:7

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