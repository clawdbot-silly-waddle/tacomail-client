# tacomail-client

A TypeScript client library for the [Tacomail](https://tacomail.de) temporary email service (API v2).

## Features

- 🎯 Full TypeScript support with type definitions
- 🔐 Automatic session management (required for API v2)
- 📧 Create inboxes and wait for emails
- 📎 Download email attachments
- 🔄 Auto-refresh sessions to keep inboxes active
- 🚀 Modern ES modules with CommonJS support
- 🛡️ Custom error types for better error handling

## Installation

```bash
npm install tacomail-client
```

## Requirements

- Node.js 18 or higher

## Quick Start

```typescript
import { TacomailClient } from 'tacomail-client';

const client = new TacomailClient();

// Create a random inbox with an active session
const inbox = await client.createRandomInbox();
console.log('Inbox address:', inbox.address);

// Wait for an email (optional filter)
const mail = await inbox.waitForMail();
console.log('From:', mail.from.address);
console.log('Subject:', mail.subject);
console.log('Body:', mail.body.text);

// Cleanup: delete the session
await inbox.cleanup(true);
```

## Important: Session Management

**Tacomail API v2 requires an active session to receive emails.** Without a session:
- Emails sent to the address will be rejected
- `getMailForAddress()` will return an empty array

Always create a session before expecting emails:
```typescript
const inbox = await client.createInbox('myinbox@tacomail.de');
// Session is now active - emails will be received
```

## API Reference

### TacomailClient

The main client for interacting with Tacomail.

#### Constructor
```typescript
new TacomailClient(server?: string)
```

#### Methods

**`async getDomains(): Promise<string[]>`**
Get available domains for creating inboxes.

**`async createInbox(address: string, options?: InboxOptions): Promise<Inbox>`**
Create an inbox with an active session.

**`getInbox(address: string): Inbox`**
Get an inbox reference without creating a session.

**`async createRandomInbox(options?: InboxOptions): Promise<Inbox>`**
Create a random inbox address with an active session.

**`async deleteSessionForInbox(address: string): Promise<void>`**
Delete the session for an inbox (doesn't delete existing emails).

**`async deleteAllSessions(): Promise<void>`**
Delete all sessions managed by this client.

**`getActiveSessions(): Session[]`**
Get all active sessions.

### Inbox

Represents a Tacomail inbox.

#### Properties
- `address: string` - The email address
- `server: string` - The server URL

#### Methods

**`async getAllMail(): Promise<Mail[]>`**
Get all emails in the inbox.

**`async deleteAllMail(): Promise<void>`**
Delete all emails in the inbox.

**`async waitForMail(filter?: (m: Mail) => boolean, timeout?: number, interval?: number): Promise<Mail>`**
Wait for a new email that matches the filter.

**`async refreshSession(): Promise<void>`**
Refresh the session for this inbox.

**`enableAutoRefresh(interval?: number): void`**
Enable automatic session refresh (default: 30 minutes).

**`disableAutoRefresh(): void`**
Disable automatic session refresh.

**`async cleanup(deleteSession?: boolean): Promise<void>`**
Cleanup: disable auto-refresh and optionally delete the session.

**`hasActiveSession(): boolean`**
Check if this inbox has an active session.

### Mail

Represents an email.

#### Properties
- `id: string` - Unique identifier
- `from: { address: string; name: string }` - Sender info
- `to: { address: string; name: string }` - Recipient info
- `subject: string` - Email subject
- `date: string` - ISO 8601 timestamp
- `body: { text: string; html: string }` - Email body
- `headers: Record<string, unknown>` - Email headers
- `attachments: Attachment[]` - List of attachments

#### Methods

**`async delete(): Promise<void>`**
Delete this email.

**`getFormattedDate(): Date`**
Get a formatted Date object.

**`getAttachmentCount(): number`**
Get the number of attachments.

### Attachment

Represents an email attachment.

#### Properties
- `id: string` - Attachment ID
- `filename: string` - Original filename

#### Methods

**`async download(): Promise<ArrayBuffer>`**
Download the attachment content.

**`getExtension(): string | null`**
Get the file extension.

**`isImage(): boolean`**
Check if the attachment is an image.

## Examples

### Create a custom inbox

```typescript
import { TacomailClient } from 'tacomail-client';

const client = new TacomailClient();
const inbox = await client.createInbox('my-custom-username@tacomail.de');
console.log('Address:', inbox.address);
```

### Wait for specific email

```typescript
// Wait for an email from a specific sender
const mail = await inbox.waitForMail((m) => m.from.address.includes('github.com'));

// Wait for an email with a specific subject
const mail = await inbox.waitForMail((m) => m.subject.includes('verify'));
```

### Download attachments

```typescript
const mail = await inbox.waitForMail();

for (const attachment of mail.attachments) {
  console.log('Attachment:', attachment.filename);

  if (attachment.isImage()) {
    const data = await attachment.download();
    // Save to file...
  }
}
```

### Use custom server

```typescript
const client = new TacomailClient('https://custom-tacomail-server.com');
const inbox = await client.createRandomInbox();
```

### Auto-refresh sessions

```typescript
// Refresh session every 20 minutes instead of default 30
const inbox = await client.createRandomInbox({ refreshInterval: 20 * 60 * 1000 });

// Or enable manually
const inbox = await client.createInbox('test@tacomail.de');
inbox.enableAutoRefresh(15 * 60 * 1000); // 15 minutes
```

### Filter emails

```typescript
const inbox = await client.createRandomInbox();
const allMails = await inbox.getAllMail();

const recentMails = allMails.filter(m => {
  const age = Date.now() - m.getFormattedDate().getTime();
  return age < 3600000; // Less than 1 hour old
});
```

### Functional API (lower-level)

If you don't need the object-oriented API, you can use the functional API:

```typescript
import {
  getAvailableDomains,
  createSession,
  getMailForAddress,
} from 'tacomail-client';

const domains = await getAvailableDomains();
await createSession('myusername', 'tacomail.de');
const mails = await getMailForAddress('myusername@tacomail.de');
```

## Error Handling

The library provides custom error types:

```typescript
import {
  TacomailError,
  SessionExpiredError,
  InboxNotFoundError,
  AttachmentNotFoundError,
} from 'tacomail-client';

try {
  const inbox = await client.createInbox('test@tacomail.de');
} catch (error) {
  if (error instanceof SessionExpiredError) {
    console.error('Session expired, refresh needed');
  } else if (error instanceof InboxNotFoundError) {
    console.error('Inbox not found or no active session');
  } else if (error instanceof TacomailError) {
    console.error(`Tacomail error: ${error.message}`);
  }
}
```

## Migration from v1.0.0

The v2.0.0 release includes breaking changes:

1. **API version**: Now uses Tacomail API v2
2. **Sessions required**: You must create a session before receiving emails
3. **Error handling**: New custom error types
4. **Default export**: No longer provides a singleton instance

Migration example:

```typescript
// v1.0.0
import tacomail from 'tacomail-client';
const domains = await tacomail.domains;

// v2.0.0
import { TacomailClient } from 'tacomail-client';
const client = new TacomailClient();
const inbox = await client.createRandomInbox(); // Creates session
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
