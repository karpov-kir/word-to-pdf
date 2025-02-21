import { createId } from '@paralleldrive/cuid2';

import { config } from '../Config';
import { chromeStorage, Storage } from '../Storage';
import { BatchRequestDto } from './BatchRequestDto';
import { ConvertRequestDto } from './ConvertRequestDto';

export enum ServerErrorType {
  ValidationError = 'validationError',
  InternalError = 'internalError',
  UnauthorizedError = 'unauthorizedError',
  NotFoundError = 'notFoundError',
  TooManyRequestsError = 'tooManyRequestsError',
  PayloadTooLargeError = 'payloadTooLargeError',
}

export interface ServerErrorDto {
  message: string;
  type: ServerErrorType;
  reason?: string;
}

const isServerErrorDto = (error: unknown): error is ServerErrorDto => {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'type' in error &&
      typeof error.type === 'string' &&
      Object.values<string>(ServerErrorType).includes(error.type),
  );
};

interface WithAbortSignal {
  abortSignal?: AbortSignal;
}

interface HttClientOptions extends WithAbortSignal {
  addAuthHeader?: boolean;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  duplex?: 'half';
}

export class ServerErrorResponse extends Error {
  constructor(
    public readonly serverError: ServerErrorDto,
    public readonly status: number,
  ) {
    super(serverError.message);
  }
}

function isPlainObject(value: unknown) {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly storage: Storage = chromeStorage,
  ) {}

  private constructUrl(path: string, { query }: HttClientOptions): URL {
    const url = new URL(path, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.append(key, value);
      }
    }

    return url;
  }

  private async prepareHeaders(
    { addAuthHeader: withCredentials, headers: customHeaders }: HttClientOptions,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (withCredentials) {
      const accessToken = await this.storage.getAccessToken();

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    if (isPlainObject(body)) {
      headers['Content-Type'] = 'application/json';
    } else if (body instanceof ReadableStream) {
      headers['Content-Type'] = 'application/octet-stream';
    }

    return {
      ...headers,
      ...customHeaders,
    };
  }

  private convertBody(body: unknown) {
    if (body instanceof FormData || body instanceof ReadableStream) {
      return body;
    }

    if (isPlainObject(body)) {
      return JSON.stringify(body);
    }

    if (!body) {
      return;
    }

    throw new Error('Unsupported body type');
  }

  private async processJsonResponse<T>(response: Response): Promise<T> {
    if (response.status === 429) {
      throw new ServerErrorResponse(
        {
          message: 'Too many requests',
          type: ServerErrorType.TooManyRequestsError,
        },
        response.status,
      );
    }

    if (response.status === 413) {
      throw new ServerErrorResponse(
        {
          message: 'Payload too large',
          type: ServerErrorType.PayloadTooLargeError,
        },
        response.status,
      );
    }

    const responseBody = await response.json();

    if (isServerErrorDto(responseBody)) {
      throw new ServerErrorResponse(responseBody, response.status);
    }

    if (!response.ok) {
      throw new Error('Could not complete request');
    }

    return responseBody;
  }

  async get<T>(path: string, options: HttClientOptions = {}): Promise<T> {
    const response = await fetch(this.constructUrl(path, options), {
      headers: await this.prepareHeaders(options),
      signal: options.abortSignal,
    });

    return this.processJsonResponse(response);
  }

  async postRaw(path: string, body: unknown, options: HttClientOptions = {}): Promise<Response> {
    const headers = await this.prepareHeaders(options, body);

    const requestInit = {
      method: 'POST',
      headers,
      body: this.convertBody(body),
      signal: options.abortSignal,
      duplex: options.duplex,
    };
    return fetch(new URL(path, this.baseUrl), requestInit);
  }

  async post<T>(path: string, body: unknown, options: HttClientOptions = {}): Promise<T> {
    return this.processJsonResponse(await this.postRaw(path, body, options));
  }

  async deleteRaw(path: string, options: HttClientOptions = {}): Promise<Response> {
    return fetch(new URL(path, this.baseUrl), {
      method: 'DELETE',
      headers: await this.prepareHeaders(options),
      signal: options.abortSignal,
    });
  }

  async delete<T>(path: string, options: HttClientOptions = {}): Promise<T> {
    return this.processJsonResponse(await this.deleteRaw(path, options));
  }
}

const convertBase64ToBlob = async (base64: string) => {
  try {
    const response = await fetch(base64);
    const blob = await response.blob();
    return blob;
  } catch (_error) {
    throw new Error('Failed to convert base64 to blob');
  }
};

export class WordToPdfApiClient {
  constructor(
    private readonly httpClient = new HttpClient(config.wordToPdfApiBaseUrl),
    private readonly storage: Storage = chromeStorage,
  ) {}

  async initAccessToken() {
    console.log('Initializing access token');

    const existingAccessToken = await this.storage.getAccessToken();

    if (existingAccessToken) {
      console.log('Access token already exists', existingAccessToken);
      return;
    }

    const response = await this.httpClient.post<{ accessToken: string }>('/auth/token', undefined);

    console.log('Access token initialized', response);
    await this.storage.setAccessToken(response.accessToken);
  }

  async createConvertRequest(wordDocumentBase64: string, fileName: string, onProgress: (progress: number) => void) {
    console.log('Creating Word document to PDF convert request');

    // const formData = new FormData();
    const fileBlob = await convertBase64ToBlob(wordDocumentBase64);
    // formData.append('file', fileBlob, fileName);

    const boundary = `----WebKitFormBoundary${createId()}`;
    let uploadedSize = 0;

    // Prepare multipart/form-data headers
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': `${fileBlob.size}`,
    };

    // Based on https://stackoverflow.com/a/69400632 + ChatGPT
    const fileStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const preamble =
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: ${fileBlob.type}\r\n\r\n`;
        controller.enqueue(encoder.encode(preamble));

        const reader = fileBlob.stream().getReader();

        read();

        function read() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.enqueue(encoder.encode(`\r\n--${boundary}--\r\n`));
                controller.close();
                return;
              }

              uploadedSize += value.length;
              onProgress(Math.round((uploadedSize / fileBlob.size) * 100));

              controller.enqueue(value);
              read();
            })
            .catch((error) => {
              controller.error(error);
            });
        }
      },
    });

    const response = await this.httpClient.post<ConvertRequestDto>('/convert-requests/create', fileStream, {
      addAuthHeader: true,
      headers,
      duplex: 'half',
    });

    console.log('Created Word document to PDF convert request', response);

    return response;
  }

  async getConvertRequestsByIds(ids: string[]): Promise<ConvertRequestDto[]> {
    console.log('Getting convert requests by IDs', ids);

    const response = await this.httpClient.post<ConvertRequestDto[]>(
      '/convert-requests/by-ids',
      {
        ids,
      },
      {
        addAuthHeader: true,
      },
    );

    console.log('Got convert requests by IDs', response);

    return response;
  }

  async createBatchRequest(convertRequestIds: string[]) {
    console.log('Creating batch request');

    const response = await this.httpClient.post<BatchRequestDto>(
      '/batch-requests/create',
      {
        convertRequestIds,
      },
      {
        addAuthHeader: true,
      },
    );

    console.log('Created batch request', response);

    return response;
  }

  async getBatchRequestsByIds(ids: string[]) {
    console.log('Getting batch requests by IDs', ids);

    const response = await this.httpClient.post<BatchRequestDto[]>(
      '/batch-requests/by-ids',
      {
        ids,
      },
      {
        addAuthHeader: true,
      },
    );

    console.log('Got batch requests by IDs', response);

    return response;
  }
}

export const wordToPdfApiClient = new WordToPdfApiClient();
