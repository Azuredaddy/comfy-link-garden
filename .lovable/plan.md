# Harden quote submissions and production delivery

## Goal
Make quote requests reliably appear in the admin portal and trigger an email, while preventing the homepage and its assets from failing after publishing.

## Changes
1. Route all quote forms through one same-origin server endpoint instead of posting directly from the browser to the database.
2. Validate and normalize every submission server-side, save it, send the notification email, and return an explicit success or recoverable error response.
3. Remove the fragile database-to-public-webhook dependency and add durable notification state so a saved quote is never lost when email delivery temporarily fails.
4. Restrict the public notification surface so arbitrary callers cannot retrieve quote details or trigger emails.
5. Improve frontend error handling and timeouts so customers get an accurate status and can retry without accidental duplicate requests.
6. Harden the admin page’s loading and update states so failed reads/writes are visible and retryable.
7. Preserve all existing public URLs and static markup, while verifying the bundled homepage, CSS, JavaScript, images, admin page, and API endpoint in a production-equivalent run.

## Validation
- Submit a test quote through the browser and confirm the saved record is visible to an authorized admin.
- Confirm one email notification is generated for the quote and duplicate submission attempts do not send duplicates.
- Check homepage text and images plus representative service/suburb pages on desktop and mobile.
- Check failed-network behavior and confirm the form never reports success before the request is safely stored.

## Technical details
- TanStack server route under `/api/public/*` with Zod validation and same-origin request checks.
- Server-side database access and email credentials remain inside the request handler.
- Idempotency key per submission protects against retries and duplicate emails.
- Existing SEO URLs, metadata, and static HTML content remain unchanged.
