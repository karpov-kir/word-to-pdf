import pRetry from 'p-retry';

import { Deferred } from '../utils/deferred';
import { Events, EventTypes } from './events';

const ensureServiceWorkerAliveThresholdMs = 10_000;

export class ChromeMessaging {
  protected async sendMessageWithRetry<T extends Events>(
    event: T,
    responseCallback?: (response: unknown) => void,
  ): Promise<void> {
    console.log('Sending message', event);
    try {
      await pRetry(
        () => {
          if (responseCallback) {
            return chrome.runtime.sendMessage(event, responseCallback);
          }

          return chrome.runtime.sendMessage(event);
        },
        {
          retries: 3,
          minTimeout: 5,
          maxTimeout: 20,
        },
      );
    } catch (error) {
      console.error(`Failed to send message`, event, error);
    }
  }

  public async sendMessage<T extends Events>(event: T): Promise<void> {
    await this.sendMessageWithRetry(event);
  }
}

/** Popup is the entrypoint, so it must ensure that the service worker is awake. */
class PopupChromeMessaging extends ChromeMessaging {
  private lastEnsuredServiceWorkerAwakeAttemptAt = 0;
  private ensureServiceWorkerAwakePromise?: Promise<void>;

  private async sendServiceWorkerAliveEvent(): Promise<void> {
    try {
      const deferred = new Deferred<unknown>();

      console.log('Sending wake service worker up event');
      this.sendMessageWithRetry({ type: EventTypes.WakeServiceWorkerUp }, (response) => {
        if (chrome.runtime.lastError) {
          deferred.reject(chrome.runtime.lastError);
        } else {
          deferred.resolve(response);
        }
      });

      const response = await deferred.promise;

      console.log(`Received acknowledgement from service worker that it's awake`, response);
    } catch (error) {
      console.error('Failed to ensure service worker is awake', error);
    }
  }

  public async ensureServiceWorkerAlive(): Promise<void> {
    if (this.ensureServiceWorkerAwakePromise) {
      return this.ensureServiceWorkerAwakePromise;
    }

    if (Date.now() - this.lastEnsuredServiceWorkerAwakeAttemptAt < ensureServiceWorkerAliveThresholdMs) {
      return;
    }

    this.lastEnsuredServiceWorkerAwakeAttemptAt = Date.now();
    this.ensureServiceWorkerAwakePromise = this.sendServiceWorkerAliveEvent();

    try {
      console.log('Waiting for service worker to acknowledge wake up event');
      await this.ensureServiceWorkerAwakePromise;
    } finally {
      this.ensureServiceWorkerAwakePromise = undefined;
    }
  }

  public async sendMessage<T extends Events>(event: T): Promise<void> {
    await this.ensureServiceWorkerAlive();
    await super.sendMessage(event);
  }
}

export const chromeMessaging = new ChromeMessaging();
export const popupChromeMessaging = new PopupChromeMessaging();
