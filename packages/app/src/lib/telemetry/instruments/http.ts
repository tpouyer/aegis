import { getHttpMeter } from '../meters';
import { extractUrlTemplate } from '../utils';

const requestDuration = getHttpMeter().createHistogram('http.client.request.duration', {
  description: 'Duration of HTTP requests including retries',
  unit: 'ms',
});

const retryCounter = getHttpMeter().createCounter('http.client.request.retry.count', {
  description: 'Number of retry attempts',
  unit: '{retry}',
});

const errorCounter = getHttpMeter().createCounter('http.client.request.error.count', {
  description: 'HTTP request errors',
  unit: '{error}',
});

const activeRequests = getHttpMeter().createUpDownCounter('http.client.active_requests', {
  description: 'Currently in-flight HTTP requests',
  unit: '{request}',
});

export function recordHttpStart(url: string): { end: (statusCode: number) => void; retry: () => void; error: (type: string) => void } {
  const template = extractUrlTemplate(url);
  const startTime = performance.now();
  let retries = 0;

  activeRequests.add(1, { 'url.template': template });

  return {
    end(statusCode: number) {
      const duration = performance.now() - startTime;
      activeRequests.add(-1, { 'url.template': template });
      requestDuration.record(duration, {
        'url.template': template,
        'http.response.status_code': statusCode,
        'http.request.resend_count': retries,
      });
    },
    retry() {
      retries++;
      retryCounter.add(1, { 'url.template': template });
    },
    error(type: string) {
      activeRequests.add(-1, { 'url.template': template });
      errorCounter.add(1, { 'url.template': template, 'error.type': type });
    },
  };
}
