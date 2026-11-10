import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { api, API_BASE } from '../src/api/client.ts';

const VALID_UUID = '11111111-2222-3333-4444-555555555555';

describe('Frontend API Client URL Construction', () => {
  let capturedUrls: { url: string; method?: string }[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    capturedUrls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      capturedUrls.push({ url, method: init?.method ?? 'GET' });
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Collection Endpoints (Must have trailing slashes)', () => {
    it('getProjects requests /api/v1/projects/', async () => {
      await api.getProjects();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/projects/`);
      assert.strictEqual(capturedUrls[0].method, 'GET');
    });

    it('createProject requests /api/v1/projects/ with POST', async () => {
      await api.createProject({ name: 'Test' });
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/projects/`);
      assert.strictEqual(capturedUrls[0].method, 'POST');
    });

    it('getTasks requests /api/v1/tasks/ and preserves trailing slash with query params', async () => {
      await api.getTasks();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/tasks/`);

      await api.getTasks({ status: 'todo' });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/tasks/?status=todo`);
    });

    it('createTask requests /api/v1/tasks/ with POST', async () => {
      await api.createTask({ project_id: VALID_UUID, title: 'Test Task' });
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/tasks/`);
      assert.strictEqual(capturedUrls[0].method, 'POST');
    });

    it('getDecisions requests /api/v1/decisions/ and preserves trailing slash with query params', async () => {
      await api.getDecisions();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/decisions/`);

      await api.getDecisions({ project_id: VALID_UUID });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/decisions/?project_id=${VALID_UUID}`);
    });

    it('createDecision requests /api/v1/decisions/ with POST', async () => {
      await api.createDecision({ project_id: VALID_UUID, title: 'Test Decision' });
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/decisions/`);
      assert.strictEqual(capturedUrls[0].method, 'POST');
    });

    it('getActivities requests /api/v1/activities/ and preserves trailing slash with query params', async () => {
      await api.getActivities();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/activities/`);

      await api.getActivities({ order: 'desc', limit: 50 });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/activities/?order=desc&limit=50`);
    });

    it('getDocuments requests /api/v1/documents/ and preserves trailing slash with query params', async () => {
      await api.getDocuments();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/documents/`);

      await api.getDocuments(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/documents/?project_id=${VALID_UUID}`);
    });

    it('getReviews requests /api/v1/reviews/ and preserves trailing slash with query params', async () => {
      await api.getReviews();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/reviews/`);

      await api.getReviews({ status: 'pending' });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/reviews/?status=pending`);
    });

    it('getHandoverReports requests /api/v1/reports/ and preserves trailing slash with query params', async () => {
      await api.getHandoverReports();
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/reports/`);

      await api.getHandoverReports(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/reports/?project_id=${VALID_UUID}`);
    });
  });

  describe('Resource & Action Endpoints (Must NOT have trailing slashes)', () => {
    it('project resource operations do not have trailing slashes', async () => {
      await api.getProject(VALID_UUID);
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/projects/${VALID_UUID}`);

      await api.updateProject(VALID_UUID, { name: 'Updated' });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/projects/${VALID_UUID}`);

      await api.deleteProject(VALID_UUID);
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/projects/${VALID_UUID}`);
    });

    it('nested project sub-resource endpoints do not have trailing slashes', async () => {
      await api.getProjectTasks(VALID_UUID);
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/projects/${VALID_UUID}/tasks`);

      await api.getProjectDecisions(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/projects/${VALID_UUID}/decisions`);

      await api.getProjectActivities(VALID_UUID);
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/projects/${VALID_UUID}/activities`);
    });

    it('task and decision resource operations do not have trailing slashes', async () => {
      await api.getTask(VALID_UUID);
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/tasks/${VALID_UUID}`);

      await api.updateTask(VALID_UUID, { title: 'New Title' });
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/tasks/${VALID_UUID}`);

      await api.deleteTask(VALID_UUID);
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/tasks/${VALID_UUID}`);

      await api.getDecision(VALID_UUID);
      assert.strictEqual(capturedUrls[3].url, `${API_BASE}/decisions/${VALID_UUID}`);

      await api.updateDecision(VALID_UUID, { title: 'New Title' });
      assert.strictEqual(capturedUrls[4].url, `${API_BASE}/decisions/${VALID_UUID}`);

      await api.deleteDecision(VALID_UUID);
      assert.strictEqual(capturedUrls[5].url, `${API_BASE}/decisions/${VALID_UUID}`);
    });

    it('document action and resource endpoints do not have trailing slashes', async () => {
      const dummyFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await api.uploadDocument(dummyFile, VALID_UUID, 'Author');
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/documents/upload`);

      await api.getDocument(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/documents/${VALID_UUID}`);

      await api.reprocessDocument(VALID_UUID);
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/documents/${VALID_UUID}/process`);

      await api.deleteDocument(VALID_UUID);
      assert.strictEqual(capturedUrls[3].url, `${API_BASE}/documents/${VALID_UUID}`);
    });

    it('review action and resource endpoints do not have trailing slashes', async () => {
      await api.getReview(VALID_UUID);
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/reviews/${VALID_UUID}`);

      await api.approveReview(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/reviews/${VALID_UUID}/approve`);

      await api.rejectReview(VALID_UUID);
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/reviews/${VALID_UUID}/reject`);

      await api.approveAllReviews({ project_id: VALID_UUID });
      assert.strictEqual(capturedUrls[3].url, `${API_BASE}/reviews/approve-all?project_id=${VALID_UUID}`);
    });

    it('report action and continuity endpoints do not have trailing slashes', async () => {
      await api.generateHandoverReport(VALID_UUID);
      assert.strictEqual(capturedUrls[0].url, `${API_BASE}/reports/generate?project_id=${VALID_UUID}`);

      await api.getHandoverReport(VALID_UUID);
      assert.strictEqual(capturedUrls[1].url, `${API_BASE}/reports/${VALID_UUID}`);

      await api.updateReportSuccessor(VALID_UUID, { incoming_owner: 'Alice' });
      assert.strictEqual(capturedUrls[2].url, `${API_BASE}/reports/${VALID_UUID}/successor`);

      assert.strictEqual(api.getHandoverReportPdfUrl(VALID_UUID), `${API_BASE}/reports/${VALID_UUID}/pdf`);

      await api.getContinuityGraph(VALID_UUID);
      assert.strictEqual(capturedUrls[3].url, `${API_BASE}/continuity/graph?project_id=${VALID_UUID}`);

      await api.getContinuityNodeDetail(VALID_UUID, 'node-123');
      assert.strictEqual(capturedUrls[4].url, `${API_BASE}/continuity/nodes/node-123?project_id=${VALID_UUID}`);
    });
  });
});
