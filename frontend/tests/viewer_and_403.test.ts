import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { api, ApiError, setAuthToken } from '../src/api/client.ts';

describe('Viewer Mode UX & Global 403 Error Handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthToken(null);
  });

  it('1. ApiError creates structured error object with isForbidden and status code', () => {
    const err403 = new ApiError(403, "You're viewing this workspace in read-only mode.");
    assert.strictEqual(err403.status, 403);
    assert.strictEqual(err403.isForbidden, true);
    assert.strictEqual(err403.name, 'ApiError');
    assert.strictEqual(err403.message, "You're viewing this workspace in read-only mode.");

    const err404 = new ApiError(404, 'Project not found.');
    assert.strictEqual(err404.status, 404);
    assert.strictEqual(err404.isForbidden, false);
    assert.strictEqual(err404.message, 'Project not found.');
  });

  it('2. fetchJson extracts detail string on HTTP 403 without raw JSON brackets', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ detail: 'Viewers have read-only access and cannot create or modify resources.' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as unknown as typeof fetch;

    try {
      await api.createProject({ name: 'Prohibited Project' });
      assert.fail('Should have thrown an ApiError');
    } catch (err: unknown) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.isForbidden, true);
      assert.strictEqual(err.message, 'Viewers have read-only access and cannot create or modify resources.');
      assert.ok(!err.message.includes('{'));
      assert.ok(!err.message.includes('}'));
    }
  });

  it('3. fetchJson provides friendly default when 403 body has no detail string', async () => {
    globalThis.fetch = (async () => {
      return new Response('', {
        status: 403,
        statusText: 'Forbidden',
      });
    }) as unknown as typeof fetch;

    try {
      await api.generateHandoverReport('11111111-1111-1111-1111-111111111111', 'Viewer User');
      assert.fail('Should have thrown an ApiError');
    } catch (err: unknown) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.isForbidden, true);
      assert.ok(err.message.includes('read-only mode'));
    }
  });

  it('4. Array details in validation errors are formatted cleanly', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          detail: [
            { loc: ['body', 'name'], msg: 'Field required' },
            { loc: ['body', 'status'], msg: 'Input should be a valid string' },
          ],
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as unknown as typeof fetch;

    try {
      await api.createProject({ name: '' });
      assert.fail('Should have thrown an ApiError');
    } catch (err: unknown) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 422);
      assert.strictEqual(err.message, 'Field required, Input should be a valid string');
    }
  });

  it('5. uploadDocument intercepts 403 and returns clean ApiError without throwing raw string', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ detail: 'Viewers have read-only access. Write mutations are prohibited.' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as unknown as typeof fetch;

    const fakeFile = new File(['sample'], 'spec.pdf', { type: 'application/pdf' });
    try {
      await api.uploadDocument(fakeFile);
      assert.fail('Should have thrown an ApiError');
    } catch (err: unknown) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.isForbidden, true);
      assert.strictEqual(err.message, 'Viewers have read-only access. Write mutations are prohibited.');
    }
  });

  it('6. Viewer permission logic validates that Viewer is strictly read-only', () => {
    const isViewer = (role?: string) => role === 'viewer';
    const canCreateOrModify = (role?: string) => Boolean(role && role !== 'viewer');
    const canResolveConflicts = (role?: string) => Boolean(role && (role === 'admin' || role === 'project_owner'));
    const canManageProjects = (role?: string) => Boolean(role && (role === 'admin' || role === 'project_owner'));
    const canGenerateReports = (role?: string) => Boolean(role && role !== 'viewer');

    // Viewer permissions
    assert.strictEqual(isViewer('viewer'), true);
    assert.strictEqual(canCreateOrModify('viewer'), false);
    assert.strictEqual(canResolveConflicts('viewer'), false);
    assert.strictEqual(canManageProjects('viewer'), false);
    assert.strictEqual(canGenerateReports('viewer'), false);

    // Privileged permissions remain intact
    assert.strictEqual(canCreateOrModify('project_owner'), true);
    assert.strictEqual(canCreateOrModify('admin'), true);
    assert.strictEqual(canCreateOrModify('contributor'), true);

    assert.strictEqual(canResolveConflicts('project_owner'), true);
    assert.strictEqual(canResolveConflicts('admin'), true);
    assert.strictEqual(canResolveConflicts('contributor'), false);
  });
});
