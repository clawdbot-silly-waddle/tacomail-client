/**
 * Represents an email attachment
 */
export interface AttachmentType {
  /** The attachment ID (used for downloading) */
  id: string;
  /** The original filename of the attachment */
  filename: string;
}

/**
 * Represents the sender or recipient of an email
 */
export interface EmailAddress {
  /** The email address */
  address: string;
  /** The display name (can be empty string) */
  name: string;
}

/**
 * Represents a single email in the inbox
 */
export interface MailType {
  /** Unique identifier for the mail */
  id: string;
  /** Sender information */
  from: EmailAddress;
  /** Recipient information */
  to: EmailAddress;
  /** Email subject */
  subject: string;
  /** ISO 8601 timestamp when the email was received */
  date: string;
  /** Email body content */
  body: {
    /** Plain text version */
    text: string;
    /** HTML version */
    html: string;
  };
  /** Email headers (key-value pairs) */
  headers: Record<string, unknown>;
  /** List of attachments */
  attachments: AttachmentType[];
}

/**
 * Represents a session for an inbox
 */
export interface Session {
  /** Full email address */
  address: string;
  /** When the session expires (Unix timestamp in milliseconds) */
  expires: number;
  /** The server URL */
  server: string;
  /** Check if the session is still valid */
  isValid: () => boolean;
}

/**
 * Options for creating an inbox
 */
export interface InboxOptions {
  /** How often to refresh the session (in milliseconds) */
  refreshInterval?: number;
}

/**
 * Error types for better error handling
 */
export class TacomailError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'TacomailError';
  }
}

export class SessionExpiredError extends TacomailError {
  constructor(address: string) {
    super(`Session for ${address} has expired`, 401, 'session');
    this.name = 'SessionExpiredError';
  }
}

export class InboxNotFoundError extends TacomailError {
  constructor(address: string) {
    super(`Inbox ${address} not found or no active session`, 404, 'inbox');
    this.name = 'InboxNotFoundError';
  }
}

export class AttachmentNotFoundError extends TacomailError {
  constructor(mailId: string, attachmentId: string) {
    super(`Attachment ${attachmentId} not found in mail ${mailId}`, 404, 'attachment');
    this.name = 'AttachmentNotFoundError';
  }
}
