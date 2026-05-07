/**
 * MSW test server configuration.
 *
 * Sets up a mock server using MSW that intercepts network requests
 * during tests. Import this in test files or wire into the global
 * test setup to enable API mocking.
 *
 * Usage in individual test files:
 *
 *   import { server } from '../mocks/server';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * For per-test overrides, use server.use(...) within a test block.
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
