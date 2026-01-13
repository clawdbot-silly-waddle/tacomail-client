import {
  getAvailableDomains,
  getMailForAddress,
  deleteAllMailForAddress,
  deleteMail,
  downloadAttachment,
  getAttachments,
  createSession,
  deleteSession,
  getRandomUsername,
} from './routes';
import { AttachmentType, MailType, Session, InboxOptions, TacomailError, SessionExpiredError } from './types';

/**
 * The main client for interacting with Tacomail
 */
export class TacomailClient {
  private domainsCache: string[] | null = null;
  private sessions: Map<string, Session> = new Map();

  constructor(private server = 'https://tacomail.de') {}

  /**
   * Get available domains for creating inboxes
   * Results are cached for the lifetime of the client instance
   */
  async getDomains(): Promise<string[]> {
    if (this.domainsCache === null) {
      this.domainsCache = await getAvailableDomains(this.server);
    }
    return [...this.domainsCache];
  }

  /**
   * Create a new inbox with an optional session
   * @param address - Full email address (e.g., "test@example.com")
   * @param options - Inbox options including session refresh interval
   */
  async createInbox(address: string, options?: InboxOptions): Promise<Inbox> {
    const [username, domain] = address.split('@');

    if (!username || !domain) {
      throw new TacomailError('Invalid email address format');
    }

    const sessionData = await createSession(username, domain, this.server);
    const session = {
      address,
      expires: sessionData.expires,
      server: this.server,
      isValid(): boolean {
        return Date.now() < this.expires;
      },
    };

    this.sessions.set(address, session);

    const inbox = new Inbox(address, this.server, session);
    if (options?.refreshInterval) {
      inbox.enableAutoRefresh(options.refreshInterval);
    }

    return inbox;
  }

  /**
   * Get an existing inbox without creating a session
   * Note: If no active session exists, the inbox won't receive new emails
   */
  getInbox(address: string): Inbox {
    const session = this.sessions.get(address);
    return new Inbox(address, this.server, session);
  }

  /**
   * Create a random inbox address and return an inbox with an active session
   */
  async createRandomInbox(options?: InboxOptions): Promise<Inbox> {
    const domains = await this.getDomains();
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const username = await getRandomUsername(this.server);
    const address = `${username}@${domain}`;

    return this.createInbox(address, options);
  }

  /**
   * Delete a session for an inbox
   * This doesn't delete existing emails, but future emails won't be saved
   */
  async deleteSessionForInbox(address: string): Promise<void> {
    const session = this.sessions.get(address);
    if (session) {
      const [username, domain] = address.split('@');
      await deleteSession(username, domain, this.server);
      this.sessions.delete(address);
    }
  }

  /**
   * Delete all sessions managed by this client
   */
  async deleteAllSessions(): Promise<void> {
    const deletePromises = Array.from(this.sessions.keys()).map((address) =>
      this.deleteSessionForInbox(address)
    );
    await Promise.all(deletePromises);
    this.sessions.clear();
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.isValid());
  }
}

/**
 * Represents a Tacomail inbox
 */
export class Inbox {
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly address: string,
    private readonly server: string,
    private readonly session?: Session
  ) {}

  /**
   * Check if this inbox has an active session
   */
  hasActiveSession(): boolean {
    return this.session?.isValid() ?? false;
  }

  /**
   * Get all emails in this inbox
   */
  async getAllMail(): Promise<Mail[]> {
    const mailData = await getMailForAddress(this.address, this.server);
    return mailData.map((mail) => new Mail(mail, this.address, this.server));
  }

  /**
   * Delete all emails in this inbox
   */
  async deleteAllMail(): Promise<void> {
    await deleteAllMailForAddress(this.address, this.server);
  }

  /**
   * Wait for a new email that matches the filter
   * @param filter - Function to filter emails
   * @param timeout - Maximum time to wait (default: 2 minutes)
   * @param interval - Check interval (default: 2 seconds)
   */
  async waitForMail(
    filter: (m: Mail) => boolean = () => true,
    timeout: number = 120000,
    interval: number = 2000
  ): Promise<Mail> {
    const start = Date.now();
    const existingMails = await this.getAllMail();
    const existingIds = new Set(existingMails.map((m) => m.id));

    while (Date.now() - start < timeout) {
      const mails = await this.getAllMail();

      // Look for new mails that match the filter
      for (const mail of mails) {
        if (!existingIds.has(mail.id) && filter(mail)) {
          return mail;
        }
      }

      // Also check existing mails in case we missed them
      for (const mail of mails) {
        if (existingIds.has(mail.id) && filter(mail)) {
          return mail;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TacomailError(`Timeout waiting for email after ${timeout}ms`);
  }

  /**
   * Refresh the session for this inbox
   * Automatically called if auto-refresh is enabled
   */
  async refreshSession(): Promise<void> {
    if (!this.session) {
      throw new TacomailError('No session to refresh');
    }

    if (!this.session.isValid()) {
      throw new SessionExpiredError(this.address);
    }

    const [username, domain] = this.address.split('@');
    const sessionData = await createSession(username, domain, this.server);
    this.session.expires = sessionData.expires;
  }

  /**
   * Enable automatic session refresh
   * @param interval - Refresh interval in milliseconds (default: 30 minutes)
   */
  enableAutoRefresh(interval: number = 30 * 60 * 1000): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshSession();
      } catch (error) {
        console.error(`Failed to refresh session for ${this.address}:`, error);
      }
    }, interval);
  }

  /**
   * Disable automatic session refresh
   */
  disableAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Cleanup: disable auto-refresh and optionally delete session
   */
  async cleanup(shouldDeleteSession = false): Promise<void> {
    this.disableAutoRefresh();
    if (shouldDeleteSession && this.session) {
      const [username, domain] = this.address.split('@');
      await deleteSession(username, domain, this.server);
    }
  }
}

/**
 * Represents an email in an inbox
 */
export class Mail implements MailType {
  public readonly id: string;
  public readonly from: { address: string; name: string };
  public readonly to: { address: string; name: string };
  public readonly subject: string;
  public readonly date: string;
  public readonly body: { text: string; html: string };
  public readonly headers: Record<string, unknown>;
  public readonly attachments: Attachment[];

  constructor(
    mail: MailType,
    private readonly address: string,
    private readonly server: string
  ) {
    this.id = mail.id;
    this.from = mail.from;
    this.to = mail.to;
    this.subject = mail.subject;
    this.date = mail.date;
    this.body = mail.body;
    this.headers = mail.headers;
    this.attachments =
      mail.attachments.map(
        (attachment) => new Attachment(attachment, this.address, this.id, this.server)
      ) ?? [];
  }

  /**
   * Delete this email
   */
  async delete(): Promise<void> {
    await deleteMail(this.address, this.id, this.server);
  }

  /**
   * Get a formatted date string
   */
  getFormattedDate(): Date {
    return new Date(this.date);
  }

  /**
   * Get the number of attachments
   */
  getAttachmentCount(): number {
    return this.attachments.length;
  }
}

/**
 * Represents an email attachment
 */
export class Attachment implements AttachmentType {
  public readonly id: string;
  public readonly filename: string;

  constructor(
    attachment: AttachmentType,
    private readonly address: string,
    private readonly mailId: string,
    private readonly server: string
  ) {
    this.id = attachment.id;
    this.filename = attachment.filename;
  }

  /**
   * Download the attachment content
   */
  async download(): Promise<ArrayBuffer> {
    return await downloadAttachment(this.address, this.mailId, this.id, this.server);
  }

  /**
   * Get the file extension
   */
  getExtension(): string | null {
    const parts = this.filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
  }

  /**
   * Check if the attachment is an image
   */
  isImage(): boolean {
    const ext = this.getExtension();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    return ext ? imageExtensions.includes(ext) : false;
  }
}
