import { createId } from '@paralleldrive/cuid2';

import { BatchRequestDto } from './wordToPdfApiClient/BatchRequestDto';
import { ConvertRequestDto } from './wordToPdfApiClient/ConvertRequestDto';

export enum ConvertRequestErrorType {
  FileTooLarge = 'fileTooLarge',
  UnknownError = 'unknownError',
  QuotaExceeded = 'quotaExceeded',
}

export enum BatchRequestErrorType {
  UnknownError = 'unknownError',
  QuotaExceeded = 'quotaExceeded',
}

export interface ConvertRequestBeingCreated {
  id: string;
  fileName: string;
  errorType?: ConvertRequestErrorType;
  errorMessage?: string;
  // 0 - 100
  uploadProgress: number;
  fileId: string;
}

export type LocalConvertRequest = Omit<ConvertRequestDto, 'id'> & {
  id: undefined;
  convertRequestBeingCreatedId: string;
};

export type RemoteConvertRequest = Omit<ConvertRequestDto, 'id'> & {
  id: string;
  convertRequestBeingCreatedId: undefined;
};

export type ConvertRequest = LocalConvertRequest | RemoteConvertRequest;

export interface BatchRequestBeingCreated {
  id: string;
  errorType?: BatchRequestErrorType;
}

export type LocalBatchRequest = Omit<BatchRequestDto, 'id'> & {
  id: undefined;
  batchRequestBeingCreatedId: string;
};

export type RemoteBatchRequest = Omit<BatchRequestDto, 'id'> & {
  id: string;
  batchRequestBeingCreatedId: undefined;
};

export type BatchRequest = LocalBatchRequest | RemoteBatchRequest;

export const isLocalConvertRequest = (convertRequest: ConvertRequest): convertRequest is LocalConvertRequest => {
  return !convertRequest.id && Boolean(convertRequest.convertRequestBeingCreatedId);
};

export const isLocalBatchRequest = (batchRequest: BatchRequest): batchRequest is LocalBatchRequest => {
  return !batchRequest.id && Boolean(batchRequest.batchRequestBeingCreatedId);
};

export interface Storage {
  getAccessToken(): Promise<string | undefined>;
  setAccessToken(accessToken: string): Promise<void>;

  getConvertRequests(): Promise<ConvertRequest[]>;
  getConvertRequestsInProgress(): Promise<RemoteConvertRequest[]>;
  appendConvertRequest(convertRequest: LocalConvertRequest): Promise<void>;
  modifyConvertRequests(modify: (convertRequests: ConvertRequest[]) => ConvertRequest[]): Promise<void>;
  modifyConvertRequestByConvertRequestBeingCreatedId(
    convertRequestBeingCreatedId: string,
    modify: (existingConvertRequest: ConvertRequest) => ConvertRequest,
  ): Promise<void>;
  removeConvertRequest(
    ids:
      | {
          convertRequestId: string;
          convertRequestBeingCreatedId: undefined;
        }
      | {
          convertRequestId: undefined;
          convertRequestBeingCreatedId: string;
        },
  ): Promise<void>;
  removeAllConvertRequests(): Promise<void>;
  removeConvertRequestByBeingCreatedId(convertRequestBeingCreatedId: string): Promise<void>;
  onConvertRequestsChanged(callback: (existingConvertRequests: ConvertRequest[]) => void): void;

  getConvertRequestsBeingCreated(): Promise<ConvertRequestBeingCreated[]>;
  appendConvertRequestBeingCreated(data: Pick<ConvertRequestBeingCreated, 'id' | 'fileName' | 'fileId'>): Promise<void>;
  modifyConvertRequestBeingCreatedById(
    id: string,
    modify: (existingConvertRequestBeingCreated: ConvertRequestBeingCreated) => ConvertRequestBeingCreated,
  ): Promise<void>;
  removeConvertRequestBeingCreated(id: string): Promise<void>;
  onConvertRequestBeingCreatedChanged(
    callback: (existingConvertRequestsBeingCreated: ConvertRequestBeingCreated[]) => void,
  ): void;

  getBatchRequest(): Promise<BatchRequest | undefined>;
  getBatchRequestInProgress(): Promise<RemoteBatchRequest | undefined>;
  createBatchRequest(batchRequest: LocalBatchRequest): Promise<void>;
  modifyBatchRequest(modify: (batchRequest: BatchRequest) => BatchRequest): Promise<void>;
  removeBatchRequest(): Promise<void>;
  onBatchRequestChanged(callback: (batchRequest?: BatchRequest) => void): void;

  getBatchRequestBeingCreated(): Promise<BatchRequestBeingCreated | undefined>;
  createBatchRequestBeingCreated(id: string): Promise<void>;
  modifyBatchRequestBeingCreated(
    modify: (batchRequestBeingCreated: BatchRequestBeingCreated) => BatchRequestBeingCreated,
  ): Promise<void>;
  removeBatchRequestBeingCreated(): Promise<void>;
  onBatchRequestBeingCreatedChanged(callback: (batchRequestBeingCreated?: BatchRequestBeingCreated) => void): void;

  shouldDisplayDownloadAllError(): Promise<boolean>;
  setShouldDisplayDownloadAllError(shouldDisplayDownloadAllError: boolean): Promise<void>;
  onShouldDisplayDownloadAllErrorChanged(callback: (shouldDisplayDownloadAllError: boolean) => void): void;

  isDarkModeEnabled(): boolean;
  setIsDarkModeEnabled(darkModeEnabled: boolean): void;

  saveFileForUploading(file: File): Promise<string>;
  getFileForUploading(fileId: string): Promise<File | undefined>;
  removeFileForUploading(fileId: string): Promise<void>;
  getIdsOfFilesForUploading(): Promise<string[]>;
  removeAllFilesForUploading(): Promise<void>;
}

interface ChromeStorageData {
  accessToken?: string;
  convertRequests?: ConvertRequest[];
  convertRequestsBeingCreated?: ConvertRequestBeingCreated[];
  batchRequest?: BatchRequest;
  batchRequestBeingCreated?: BatchRequestBeingCreated;
  hasPopupPingedServiceWorker?: boolean;
  shouldDisplayDownloadAllError?: boolean;
}

export class ChromeStorage implements Storage {
  private storageAccessQueue: Promise<unknown> = Promise.resolve();

  private async runViaQueue<T>(action: () => Promise<T>): Promise<T> {
    // Never fails
    const newStorageAccessActionPromise = this.storageAccessQueue.then<
      | { result: undefined; error: Error }
      | {
          result: T;
          error: undefined;
        }
    >(async () => {
      try {
        return {
          result: await action(),
          error: undefined,
        };
      } catch (error) {
        return {
          result: undefined,
          error: error instanceof Error ? error : new Error(`Unknown storage access error: ${error}`),
        };
      }
    });

    this.storageAccessQueue = newStorageAccessActionPromise;

    const data = await newStorageAccessActionPromise;

    if (data.error !== undefined) {
      throw data.error;
    }

    return data.result;
  }

  /* #region access token */
  async getAccessToken(): Promise<string | undefined> {
    const { accessToken } = await chrome.storage.local.get<ChromeStorageData>('accessToken');

    return accessToken;
  }

  async setAccessToken(accessToken: string): Promise<void> {
    return this.runViaQueue(() => chrome.storage.local.set<ChromeStorageData>({ accessToken }));
  }
  /* #endregion */

  /* #region convert requests */
  async getConvertRequests(): Promise<ConvertRequest[]> {
    const { convertRequests = [] } = await chrome.storage.local.get<ChromeStorageData>('convertRequests');

    return convertRequests;
  }

  async getConvertRequestsInProgress(): Promise<RemoteConvertRequest[]> {
    const convertRequests = await this.getConvertRequests();
    const convertRequestsInProgress: RemoteConvertRequest[] = [];

    convertRequests.forEach((convertRequest) => {
      if (['queued', 'converting'].includes(convertRequest.status) && convertRequest.id) {
        convertRequestsInProgress.push(convertRequest);
      }
    });

    return convertRequestsInProgress;
  }

  async appendConvertRequest(convertRequest: ConvertRequest): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequests: existingConvertRequests = [] } =
        await chrome.storage.local.get<ChromeStorageData>('convertRequests');

      await chrome.storage.local.set<ChromeStorageData>({
        convertRequests: [...existingConvertRequests, convertRequest],
      });
    });
  }

  async modifyConvertRequests(modify: (convertRequests: ConvertRequest[]) => ConvertRequest[]): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequests: existingConvertRequests = [] } =
        await chrome.storage.local.get<ChromeStorageData>('convertRequests');

      await chrome.storage.local.set<ChromeStorageData>({ convertRequests: modify(existingConvertRequests) });
    });
  }

  async modifyConvertRequestByConvertRequestBeingCreatedId(
    convertRequestBeingCreatedId: string,
    modify: (existingConvertRequest: ConvertRequest) => ConvertRequest,
  ): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequests: existingConvertRequests = [] } =
        await chrome.storage.local.get<ChromeStorageData>('convertRequests');

      await chrome.storage.local.set<ChromeStorageData>({
        convertRequests: existingConvertRequests.map((existingConvertRequest) =>
          existingConvertRequest.convertRequestBeingCreatedId === convertRequestBeingCreatedId
            ? modify(existingConvertRequest)
            : existingConvertRequest,
        ),
      });
    });
  }

  async removeConvertRequest({
    convertRequestId,
    convertRequestBeingCreatedId,
  }:
    | {
        convertRequestId: string;
        convertRequestBeingCreatedId: undefined;
      }
    | {
        convertRequestId: undefined;
        convertRequestBeingCreatedId: string;
      }): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequests: existingConvertRequests = [] } =
        await chrome.storage.local.get<ChromeStorageData>('convertRequests');

      await chrome.storage.local.set<ChromeStorageData>({
        convertRequests: existingConvertRequests.filter((convertRequest) =>
          convertRequestId
            ? convertRequest.id !== convertRequestId
            : convertRequest.convertRequestBeingCreatedId !== convertRequestBeingCreatedId,
        ),
      });

      if (convertRequestBeingCreatedId) {
        const { convertRequestsBeingCreated: existingConvertRequestsBeingCreated = [] } =
          await chrome.storage.session.get<ChromeStorageData>('convertRequestsBeingCreated');

        await chrome.storage.session.set<ChromeStorageData>({
          convertRequestsBeingCreated: existingConvertRequestsBeingCreated.filter(
            (convertRequestBeingCreated) => convertRequestBeingCreated.id !== convertRequestBeingCreatedId,
          ),
        });
      }
    });
  }

  async removeAllConvertRequests(): Promise<void> {
    return this.runViaQueue(async () => {
      await chrome.storage.local.remove('convertRequests');
      await chrome.storage.session.remove('convertRequestsBeingCreated');
      await chrome.storage.local.remove('batchRequest');
      await chrome.storage.local.remove('batchRequestBeingCreated');
    });
  }

  async removeConvertRequestByBeingCreatedId(convertRequestBeingCreatedId: string): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequests: existingConvertRequests = [] } =
        await chrome.storage.local.get<ChromeStorageData>('convertRequests');

      await chrome.storage.local.set<ChromeStorageData>({
        convertRequests: existingConvertRequests.filter(
          (convertRequest) => convertRequest.convertRequestBeingCreatedId !== convertRequestBeingCreatedId,
        ),
      });
    });
  }

  onConvertRequestsChanged(callback: (convertRequests: ConvertRequest[]) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (!changes.convertRequests) {
        return;
      }

      callback(changes.convertRequests.newValue || []);
    });
  }
  /* #endregion */

  /* #region convert requests being created */
  async getConvertRequestsBeingCreated(): Promise<ConvertRequestBeingCreated[]> {
    const { convertRequestsBeingCreated = [] } =
      await chrome.storage.session.get<ChromeStorageData>('convertRequestsBeingCreated');

    return convertRequestsBeingCreated;
  }

  async appendConvertRequestBeingCreated({
    id,
    fileId,
    fileName,
  }: Pick<ConvertRequestBeingCreated, 'id' | 'fileId' | 'fileName'>): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequestsBeingCreated: existingConvertRequestBeingCreated = [] } =
        await chrome.storage.session.get<ChromeStorageData>('convertRequestsBeingCreated');

      await chrome.storage.session.set<ChromeStorageData>({
        convertRequestsBeingCreated: [
          ...existingConvertRequestBeingCreated,
          {
            id,
            fileName,
            fileId,
            uploadProgress: 0,
          },
        ],
      });
    });
  }

  async modifyConvertRequestBeingCreatedById(
    id: string,
    modify: (existingConvertRequestBeingCreated: ConvertRequestBeingCreated) => ConvertRequestBeingCreated,
  ): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequestsBeingCreated: existingConvertRequestsBeingCreated = [] } =
        await chrome.storage.session.get<ChromeStorageData>('convertRequestsBeingCreated');

      await chrome.storage.session.set<ChromeStorageData>({
        convertRequestsBeingCreated: existingConvertRequestsBeingCreated.map((convertRequestBeingCreated) =>
          convertRequestBeingCreated.id === id ? modify(convertRequestBeingCreated) : convertRequestBeingCreated,
        ),
      });
    });
  }

  async removeConvertRequestBeingCreated(id: string): Promise<void> {
    return this.runViaQueue(async () => {
      const { convertRequestsBeingCreated: existingConvertRequestsBeingCreated = [] } =
        await chrome.storage.session.get<ChromeStorageData>('convertRequestsBeingCreated');

      await chrome.storage.session.set<ChromeStorageData>({
        convertRequestsBeingCreated: existingConvertRequestsBeingCreated.filter(
          (convertRequestBeingCreated) => convertRequestBeingCreated.id !== id,
        ),
      });
    });
  }

  onConvertRequestBeingCreatedChanged(
    callback: (existingConvertRequestsBeingCreated: ConvertRequestBeingCreated[]) => void,
  ): void {
    chrome.storage.session.onChanged.addListener((changes) => {
      if (!changes.convertRequestsBeingCreated) {
        return;
      }

      callback(changes.convertRequestsBeingCreated.newValue || []);
    });
  }
  /* #endregion */

  /* #region batch request */
  async getBatchRequest(): Promise<BatchRequest | undefined> {
    const { batchRequest } = await chrome.storage.local.get<ChromeStorageData>('batchRequest');

    return batchRequest;
  }

  async getBatchRequestInProgress(): Promise<RemoteBatchRequest | undefined> {
    const maybeBatchRequestInProgress = await this.getBatchRequest();

    if (
      !maybeBatchRequestInProgress ||
      !maybeBatchRequestInProgress.id ||
      ['done', 'error'].includes(maybeBatchRequestInProgress.status)
    ) {
      return;
    }

    return maybeBatchRequestInProgress;
  }

  async createBatchRequest(batchRequest: LocalBatchRequest): Promise<void> {
    return this.runViaQueue(() => chrome.storage.local.set<ChromeStorageData>({ batchRequest }));
  }

  async modifyBatchRequest(modify: (batchRequest: BatchRequest) => BatchRequest): Promise<void> {
    return this.runViaQueue(async () => {
      const { batchRequest: existingBatchRequest } = await chrome.storage.local.get<ChromeStorageData>('batchRequest');

      if (!existingBatchRequest) {
        return;
      }

      await chrome.storage.local.set<ChromeStorageData>({ batchRequest: modify(existingBatchRequest) });
    });
  }

  async removeBatchRequest(): Promise<void> {
    return this.runViaQueue(() => chrome.storage.local.remove('batchRequest'));
  }

  onBatchRequestChanged(callback: (batchRequest?: BatchRequest) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (!changes.batchRequest) {
        return;
      }

      callback(changes.batchRequest.newValue);
    });
  }
  /* #endregion */

  /* #region batch request being created */
  async getBatchRequestBeingCreated(): Promise<BatchRequestBeingCreated | undefined> {
    const { batchRequestBeingCreated } = await chrome.storage.local.get<ChromeStorageData>('batchRequestBeingCreated');

    return batchRequestBeingCreated;
  }

  async createBatchRequestBeingCreated(id: string): Promise<void> {
    return this.runViaQueue(() => chrome.storage.local.set<ChromeStorageData>({ batchRequestBeingCreated: { id } }));
  }

  async modifyBatchRequestBeingCreated(
    modify: (batchRequestBeingCreated: BatchRequestBeingCreated) => BatchRequestBeingCreated,
  ): Promise<void> {
    return this.runViaQueue(async () => {
      const { batchRequestBeingCreated } =
        await chrome.storage.local.get<ChromeStorageData>('batchRequestBeingCreated');

      if (!batchRequestBeingCreated) {
        return;
      }

      await chrome.storage.local.set<ChromeStorageData>({ batchRequestBeingCreated: modify(batchRequestBeingCreated) });
    });
  }

  async removeBatchRequestBeingCreated(): Promise<void> {
    return this.runViaQueue(() => chrome.storage.local.remove('batchRequestBeingCreated'));
  }

  onBatchRequestBeingCreatedChanged(callback: (batchRequestBeingCreated?: BatchRequestBeingCreated) => void): void {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (!changes.batchRequestBeingCreated) {
        return;
      }

      callback(changes.batchRequestBeingCreated.newValue);
    });
  }
  /* #endregion */

  /* #region download all error */
  async shouldDisplayDownloadAllError(): Promise<boolean> {
    const { shouldDisplayDownloadAllError } = await chrome.storage.session.get<ChromeStorageData>(
      'shouldDisplayDownloadAllError',
    );

    return Boolean(shouldDisplayDownloadAllError);
  }

  async setShouldDisplayDownloadAllError(shouldDisplayDownloadAllError: boolean): Promise<void> {
    return this.runViaQueue(() => chrome.storage.session.set<ChromeStorageData>({ shouldDisplayDownloadAllError }));
  }

  onShouldDisplayDownloadAllErrorChanged(callback: (shouldDisplayDownloadAllError: boolean) => void): void {
    chrome.storage.session.onChanged.addListener((changes) => {
      if (!changes.shouldDisplayDownloadAllError) {
        return;
      }

      callback(changes.shouldDisplayDownloadAllError.newValue || false);
    });
  }
  /* #endregion */

  /* #region dark mode */
  isDarkModeEnabled() {
    if (localStorage.getItem('darkMode') === null) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return localStorage.getItem('darkMode') === 'true';
  }

  setIsDarkModeEnabled(isDarkModeEnabled: boolean) {
    return localStorage.setItem('darkMode', String(isDarkModeEnabled));
  }
  /* #endregion */

  /* #region file for uploading */
  private readonly dbVersion = 2;
  private readonly dbName = 'FileTransferDB';
  private readonly filesToreName = 'files';
  private isReady = false;
  private async getDbConnection(): Promise<IDBDatabase> {
    if (!this.isReady) {
      this.isReady = true;
      try {
        await this.getIdsOfFilesForUploading();
      } catch (getIdsError) {
        try {
          console.error('DB is corrupted, it will be re-created', getIdsError);
          const request = indexedDB.deleteDatabase(this.dbName);

          await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
          });
        } catch (error) {
          console.error('Failed delete corrupted db', error);
        }
      }
    }
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.filesToreName)) {
          db.createObjectStore(this.filesToreName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (_event: Event) => {
        resolve(request.result);
      };

      request.onerror = (error) => reject(error);
    });
  }
  async saveFileForUploading(file: File): Promise<string> {
    const id = createId();
    const db = await this.getDbConnection();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.filesToreName, 'readwrite');
        const store = transaction.objectStore(this.filesToreName);

        const fileEntry = { id, file };
        const addRequest = store.put(fileEntry);

        addRequest.onsuccess = () => resolve(id);
        addRequest.onerror = (error) => reject(error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getFileForUploading(fileId: string): Promise<File | undefined> {
    const db = await this.getDbConnection();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.filesToreName, 'readonly');
        const store = transaction.objectStore(this.filesToreName);

        const getRequest = store.get(fileId);

        getRequest.onsuccess = () => {
          const fileEntry = getRequest.result;

          if (!fileEntry) {
            resolve(undefined);
            return;
          }

          resolve(fileEntry.file);
        };

        getRequest.onerror = (error) => reject(error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async removeFileForUploading(fileId: string): Promise<void> {
    const db = await this.getDbConnection();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.filesToreName, 'readwrite');
        const store = transaction.objectStore(this.filesToreName);

        const deleteRequest = store.delete(fileId);

        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = (error) => reject(error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getIdsOfFilesForUploading(): Promise<string[]> {
    const db = await this.getDbConnection();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.filesToreName, 'readonly');
        const store = transaction.objectStore(this.filesToreName);

        const getRequest = store.getAllKeys();

        getRequest.onsuccess = () => {
          resolve(getRequest.result as string[]);
        };

        getRequest.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async removeAllFilesForUploading(): Promise<void> {
    const db = await this.getDbConnection();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.filesToreName, 'readwrite');
        const store = transaction.objectStore(this.filesToreName);

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = (error) => reject(error);
      } catch (error) {
        reject(error);
      }
    });
  }
  /* #endregion */
}

export const chromeStorage: Storage = new ChromeStorage();
