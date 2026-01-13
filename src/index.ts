/**
 * @module tacomail-client
 *
 * A TypeScript client library for the Tacomail temporary email service.
 *
 * @example
 * ```typescript
 * import { TacomailClient } from 'tacomail-client';
 *
 * const client = new TacomailClient();
 * const inbox = await client.createRandomInbox();
 * console.log('Inbox address:', inbox.address);
 * const mail = await inbox.waitForMail();
 * console.log('Received:', mail.subject);
 * await inbox.cleanup(true);
 * ```
 */

export * from './routes';
export * from './classes';
export * from './types';

export { TacomailClient as default } from './classes';
