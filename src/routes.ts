import axios, { AxiosError } from 'axios';
import { MailType, Session, TacomailError, InboxNotFoundError } from './types';

const DEFAULT_SERVER = 'https://tacomail.de';
const API_PREFIX = '/api/v2';

/**
 * Get all domains available for creating inboxes
 */
export async function getAvailableDomains(server = DEFAULT_SERVER): Promise<string[]> {
  try {
    const response = await axios.get(`${server}${API_PREFIX}/domains`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'GET /domains');
  }
}

/**
 * Get all mail for a specific address
 * Note: This will return empty if no active session exists for this address
 */
export async function getMailForAddress(address: string, server = DEFAULT_SERVER): Promise<MailType[]> {
  try {
    const response = await axios.get(`${server}${API_PREFIX}/mail/${encodeURIComponent(address)}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, `GET /mail/${address}`);
  }
}

/**
 * Get a single mail by ID
 */
export async function getSingleMail(
  address: string,
  mailId: string,
  server = DEFAULT_SERVER
): Promise<MailType> {
  try {
    const response = await axios.get(
      `${server}${API_PREFIX}/mail/${encodeURIComponent(address)}/${mailId}`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error, `GET /mail/${address}/${mailId}`);
  }
}

/**
 * Delete a single mail
 */
export async function deleteMail(address: string, mailId: string, server = DEFAULT_SERVER): Promise<void> {
  try {
    await axios.delete(`${server}${API_PREFIX}/mail/${encodeURIComponent(address)}/${mailId}`);
  } catch (error) {
    throw handleApiError(error, `DELETE /mail/${address}/${mailId}`);
  }
}

/**
 * Delete all mail for an address
 */
export async function deleteAllMailForAddress(
  address: string,
  server = DEFAULT_SERVER
): Promise<void> {
  try {
    await axios.delete(`${server}${API_PREFIX}/mail/${encodeURIComponent(address)}`);
  } catch (error) {
    throw handleApiError(error, `DELETE /mail/${address}`);
  }
}

/**
 * Download an attachment
 */
export async function downloadAttachment(
  address: string,
  mailId: string,
  attachmentId: string,
  server = DEFAULT_SERVER
): Promise<ArrayBuffer> {
  try {
    const response = await axios.get(
      `${server}${API_PREFIX}/mail/${encodeURIComponent(address)}/${mailId}/${attachmentId}`,
      { responseType: 'arraybuffer' }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error, `GET /mail/${address}/${mailId}/${attachmentId}`);
  }
}

/**
 * Get list of attachments for a mail
 */
export async function getAttachments(
  address: string,
  mailId: string,
  server = DEFAULT_SERVER
): Promise<{ id: string; filename: string }[]> {
  try {
    const response = await axios.get(
      `${server}${API_PREFIX}/mail/${encodeURIComponent(address)}/${mailId}/attachments`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error, `GET /mail/${address}/${mailId}/attachments`);
  }
}

/**
 * Create a session for an inbox (required to receive emails)
 * @param username - The local part of the email (before @)
 * @param domain - The domain part (after @)
 * @param server - The tacomail server URL
 * @returns Session info with expiration time
 */
export async function createSession(
  username: string,
  domain: string,
  server = DEFAULT_SERVER
): Promise<{ expires: number }> {
  try {
    const response = await axios.post(`${server}${API_PREFIX}/session`, {
      username,
      domain,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'POST /session');
  }
}

/**
 * Delete a session for an inbox
 * Note: This doesn't delete existing emails, only the session
 */
export async function deleteSession(
  username: string,
  domain: string,
  server = DEFAULT_SERVER
): Promise<void> {
  try {
    await axios.delete(`${server}${API_PREFIX}/session`, {
      data: { username, domain },
    });
  } catch (error) {
    throw handleApiError(error, 'DELETE /session');
  }
}

/**
 * Get the contact email for the server
 */
export async function getContactEmail(server = DEFAULT_SERVER): Promise<string> {
  try {
    const response = await axios.get(`${server}${API_PREFIX}/contactEmail`);
    // v2 API returns { email: "string" }
    return response.data.email || response.data;
  } catch (error) {
    throw handleApiError(error, 'GET /contactEmail');
  }
}

/**
 * Get a random username suggestion
 */
export async function getRandomUsername(server = DEFAULT_SERVER): Promise<string> {
  try {
    const response = await axios.get(`${server}${API_PREFIX}/randomUsername`);
    // v2 API returns { username: "string" }
    return response.data.username || response.data;
  } catch (error) {
    throw handleApiError(error, 'GET /randomUsername');
  }
}

/**
 * Helper to convert axios errors to TacomailError
 */
function handleApiError(error: unknown, endpoint: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data as any;

    // Special handling for 404 on mail endpoint - likely no session
    if (endpoint.startsWith('GET /mail/') && status === 404) {
      const addressMatch = endpoint.match(/GET \/mail\/([^\/]+)/);
      const address = addressMatch ? addressMatch[1] : 'unknown';
      throw new InboxNotFoundError(address);
    }

    const message =
      data?.message || data?.error || axiosError.message || 'Unknown API error';
    throw new TacomailError(message, status, endpoint);
  }

  throw new TacomailError(error instanceof Error ? error.message : 'Unknown error', undefined, endpoint);
}
