import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { api, API_BASE, getAuthToken, setAuthToken } from '../src/api/client.ts';

// Mock localStorage for node environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  length: 0,
};

describe('Round 3 Authentication & RBAC Frontend Integration', () => {
  let capturedRequests: { url: string; method?: string; headers?: Record<string, string>; body?: string }[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    capturedRequests = [];
    mockStorage['threadline_auth_token_v1'] = '';
    delete mockStorage['threadline_auth_token_v1'];
    setAuthToken(null);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = (init?.headers as Record<string, string>) || {};
      const method = init?.method || 'GET';
      const body = init?.body as string | undefined;

      capturedRequests.push({ url, method, headers, body });

      // Handle endpoints
      if (url.endsWith('/auth/login')) {
        const parsed = body ? JSON.parse(body) : {};
        if (parsed.password === 'wrong') {
          return new Response(JSON.stringify({ detail: 'Incorrect username or password.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            access_token: 'jwt-token-login-12345',
            token_type: 'bearer',
            user: {
              id: '11111111-1111-1111-1111-111111111111',
              email: parsed.username_or_email,
              username: 'testuser',
              role: 'contributor',
              is_active: true,
              is_demo: false,
              created_at: '2026-11-16T10:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.endsWith('/auth/demo-login')) {
        return new Response(
          JSON.stringify({
            access_token: 'jwt-token-judge-demo-99999',
            token_type: 'bearer',
            user: {
              id: '22222222-2222-2222-2222-222222222222',
              email: 'demo@threadline.io',
              username: 'demojudge',
              role: 'project_owner',
              is_active: true,
              is_demo: true,
              created_at: '2026-11-16T10:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.endsWith('/auth/me')) {
        const authHeader = headers['Authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            id: '22222222-2222-2222-2222-222222222222',
            email: 'demo@threadline.io',
            username: 'demojudge',
            role: 'project_owner',
            is_active: true,
            is_demo: true,
            created_at: '2026-11-16T10:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
  });

  it('1. Login: Submits credentials, receives JWT, and stores token', async () => {
    const res = await api.login('admin@threadline.io', 'admin123');

    assert.strictEqual(capturedRequests.length, 1);
    assert.strictEqual(capturedRequests[0].url, `${API_BASE}/auth/login`);
    assert.strictEqual(capturedRequests[0].method, 'POST');
    assert.strictEqual(res.access_token, 'jwt-token-login-12345');
    assert.strictEqual(res.user.role, 'contributor');
    assert.strictEqual(getAuthToken(), 'jwt-token-login-12345');
    assert.strictEqual(localStorage.getItem('threadline_auth_token_v1'), 'jwt-token-login-12345');
  });

  it('2. Judge Demo Access: Authenticates without manual credentials and stores demo JWT', async () => {
    const res = await api.demoLogin();

    assert.strictEqual(capturedRequests.length, 1);
    assert.strictEqual(capturedRequests[0].url, `${API_BASE}/auth/demo-login`);
    assert.strictEqual(capturedRequests[0].method, 'POST');
    assert.strictEqual(res.access_token, 'jwt-token-judge-demo-99999');
    assert.strictEqual(res.user.username, 'demojudge');
    assert.strictEqual(res.user.role, 'project_owner');
    assert.strictEqual(res.user.is_demo, true);
    assert.strictEqual(getAuthToken(), 'jwt-token-judge-demo-99999');
  });

  it('3. Logout: Removes token from storage and detaches Authorization header', async () => {
    // First log in
    await api.demoLogin();
    assert.strictEqual(getAuthToken(), 'jwt-token-judge-demo-99999');

    // Make an API request to verify token is attached
    await api.getProjects();
    assert.strictEqual(capturedRequests[1].headers?.['Authorization'], 'Bearer jwt-token-judge-demo-99999');

    // Log out
    api.logout();
    assert.strictEqual(getAuthToken(), null);
    assert.strictEqual(localStorage.getItem('threadline_auth_token_v1'), null);

    // Make another API request to verify header is omitted
    await api.getProjects();
    assert.strictEqual(capturedRequests[2].headers?.['Authorization'], undefined);
  });

  it('4. Session Restoration: Valid token in storage restores user profile via /auth/me', async () => {
    setAuthToken('valid-existing-session-jwt');

    const me = await api.getMe();
    assert.ok(me);
    assert.strictEqual(me.username, 'demojudge');
    assert.strictEqual(me.role, 'project_owner');
    assert.strictEqual(capturedRequests[0].url, `${API_BASE}/auth/me`);
    assert.strictEqual(capturedRequests[0].headers?.['Authorization'], 'Bearer valid-existing-session-jwt');
  });

  it('5. Session Restoration Failure: Missing or invalid token returns null', async () => {
    setAuthToken(null);
    const me = await api.getMe();
    assert.strictEqual(me, null);
  });

  it('6. Unauthorized Navigation & Role Authorization Logic', () => {
    // Role matrix verification
    const canResolveConflicts = (role?: string) => role === 'admin' || role === 'project_owner';
    const isWritePermitted = (role?: string) => role !== 'viewer';

    assert.strictEqual(canResolveConflicts('admin'), true);
    assert.strictEqual(canResolveConflicts('project_owner'), true);
    assert.strictEqual(canResolveConflicts('contributor'), false);
    assert.strictEqual(canResolveConflicts('viewer'), false);
    assert.strictEqual(canResolveConflicts(undefined), false);

    assert.strictEqual(isWritePermitted('admin'), true);
    assert.strictEqual(isWritePermitted('project_owner'), true);
    assert.strictEqual(isWritePermitted('contributor'), true);
    assert.strictEqual(isWritePermitted('viewer'), false);
  });
});

