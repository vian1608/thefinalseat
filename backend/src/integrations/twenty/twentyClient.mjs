const DEFAULT_TIMEOUT_MS = 15000;

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

export class TwentyApiError extends Error {
  constructor(message, { status = 500, code = 'TWENTY_API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'TwentyApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class TwentyClient {
  constructor({ baseUrl, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = trimTrailingSlash(baseUrl || process.env.TWENTY_BASE_URL || '');
    this.apiKey = apiKey || process.env.TWENTY_API_KEY || '';
    this.timeoutMs = Number(timeoutMs || process.env.TWENTY_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    this.fetchImpl = fetchImpl;
  }

  get isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new TwentyApiError('Twenty CRM is not configured.', {
        status: 503,
        code: 'TWENTY_NOT_CONFIGURED',
      });
    }
  }

  async request(path, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
    this.assertConfigured();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(timeoutMs || this.timeoutMs));

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();
      let payload = null;

      if (rawBody && contentType.includes('application/json')) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const safeText = rawBody && !rawBody.trim().startsWith('<')
          ? rawBody.trim().slice(0, 500)
          : null;

        throw new TwentyApiError(
          payload?.error?.message || payload?.message || safeText || `Twenty API request failed with HTTP ${response.status}.`,
          {
            status: response.status,
            code: payload?.error?.code || 'TWENTY_HTTP_ERROR',
            details: payload,
          },
        );
      }

      if (rawBody && !payload && contentType.includes('application/json')) {
        throw new TwentyApiError('Twenty returned invalid JSON.', {
          status: 502,
          code: 'TWENTY_INVALID_JSON',
        });
      }

      return payload ?? rawBody;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new TwentyApiError(`Twenty CRM did not respond within ${Number(timeoutMs || this.timeoutMs)} ms.`, {
          status: 504,
          code: 'TWENTY_TIMEOUT',
        });
      }

      if (error instanceof TwentyApiError) throw error;

      throw new TwentyApiError(error?.message || 'Unable to contact Twenty CRM.', {
        status: 502,
        code: 'TWENTY_NETWORK_ERROR',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  list(objectPluralName, query = '') {
    return this.request(`/rest/${objectPluralName}${query ? `?${query}` : ''}`);
  }

  create(objectPluralName, record) {
    return this.request(`/rest/${objectPluralName}`, { method: 'POST', body: record });
  }

  update(objectPluralName, recordId, record) {
    return this.request(`/rest/${objectPluralName}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      body: record,
    });
  }

  delete(objectPluralName, recordId) {
    return this.request(`/rest/${objectPluralName}/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
    });
  }
}

export const twentyClient = new TwentyClient();
