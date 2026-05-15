/**
 * Unit tests for packages/server/src/services/commitService.ts
 * Covers: calculatePoints (pure fn), findAll, findById, create, remove
 */

import {
  CommitService,
  validateAndCalculatePoints,
} from '../../../../packages/server/src/services/commitService';
import { mockCommits } from '../../../fixtures/commits';

// ---------------------------------------------------------------------------
// calculatePoints — pure function, no setup needed
// ---------------------------------------------------------------------------
describe('validateAndCalculatePoints()', () => {
  const cases: [string, number, boolean][] = [
    ['feat: add new feature with enough length', 12, true], // len 34 > 30 (+2)
    ['fix: resolve a serious bug here indeed',    10,  true], // len 31 > 30 (+2)
    ['perf: speed up database query significantly and also optimize indices', 12,  true], // len 52 > 50 (+5) -> 7+5=12
    ['refactor: clean up technical debt',          6,  true], // len 23 < 30
    ['test: add unit tests for services',          5,  true], // len 22 < 30
    ['ci: add pipeline for automated tests',       6,  true], // len 32 > 30 (+2)
    ['docs: update the readme documentation',      5,  true], // len 31 > 30 (+2)
    ['style: format all files in src',             2,  true], // len 20 < 30
    ['chore: update dependencies to latest',       2,  true], // len 26 < 30
    ['random message that is long enough to be valid', 1, true],
    ['abc',                                         0, false], // < 5
    ['',                                            0, false],
  ];

  it.each(cases)('"%s" → %d points (valid: %p)', (message, expectedPoints, expectedValid) => {
    const result = validateAndCalculatePoints(message);
    expect(result.points).toBe(expectedPoints);
    expect(result.isValid).toBe(expectedValid);
  });

  it('is case-insensitive for prefix matching', () => {
    expect(validateAndCalculatePoints('FEAT: brand new feature for users').points).toBe(10);
    expect(validateAndCalculatePoints('Fix: critical security patch applied').points).toBe(10); // 8 + 2
  });

  it('returns 0 points and isValid: false for empty string', () => {
    const result = validateAndCalculatePoints('');
    expect(result.points).toBe(0);
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CommitService
// ---------------------------------------------------------------------------
describe('CommitService', () => {
  let service: CommitService;

  beforeEach(() => {
    service = new CommitService();
    // Reset to known fixture data before each test
    service._reset([...mockCommits.map((c) => ({ ...c, hash: 'mock-hash-' + c.id }))]);
  });

  // ---- findAll ----
  describe('findAll()', () => {
    it('returns all commits with default pagination', async () => {
      const { data, total } = await service.findAll();
      expect(total).toBe(mockCommits.length);
      expect(data.length).toBeLessThanOrEqual(10);
    });

    it('respects page and limit', async () => {
      const { data, total } = await service.findAll({ page: 1, limit: 2 });
      expect(data).toHaveLength(2);
      expect(total).toBe(mockCommits.length);
      expect(data[0].id).toBe('commit-1');
    });

    it('returns second page correctly', async () => {
      const { data } = await service.findAll({ page: 2, limit: 2 });
      expect(data[0].id).toBe('commit-3');
    });

    it('returns empty array for page beyond available data', async () => {
      const { data } = await service.findAll({ page: 999, limit: 10 });
      expect(data).toHaveLength(0);
    });

    it('returns empty array and zero total when store is empty', async () => {
      service._reset([]);
      const { data, total } = await service.findAll();
      expect(data).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  // ---- findById ----
  describe('findById()', () => {
    it('returns the correct commit for a valid id', async () => {
      const commit = await service.findById('commit-1');
      expect(commit.id).toBe('commit-1');
      expect(commit.message).toBe('feat: add authentication system');
    });

    it('throws 404 AppError for a non-existent id', async () => {
      await expect(service.findById('nonexistent'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('includes the missing id in the error message', async () => {
      await expect(service.findById('ghost-id'))
        .rejects.toThrow('ghost-id');
    });
  });

  // ---- create ----
  describe('create()', () => {
    it('creates a commit and assigns correct points for feat prefix', async () => {
      const commit = await service.create({
        message: 'feat: brand new thing',
        repo: 'my-repo',
        hash: 'abcdef123456',
        authorId: 'user-1',
      });
      expect(commit.id).toBeTruthy();
      expect(commit.points).toBe(10);
      expect(commit.createdAt).toBeInstanceOf(Date);
    });

    it('assigns 1 point for non-conventional commit message', async () => {
      const commit = await service.create({
        message: 'random commit message that is long enough',
        repo: 'my-repo',
        hash: 'abcdef123457',
        authorId: 'user-1',
      });
      expect(commit.points).toBe(1);
    });

    it('throws 400 AppError for empty message', async () => {
      await expect(
        service.create({ message: '', repo: 'repo', hash: '1234567', authorId: 'user-1' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 AppError for whitespace-only message', async () => {
      await expect(
        service.create({ message: '   ', repo: 'repo', hash: '1234567', authorId: 'user-1' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('persists the new commit so findById can retrieve it', async () => {
      const created = await service.create({
        message: 'fix: persist test with enough length',
        repo: 'repo',
        hash: 'abcdef123458',
        authorId: 'user-1',
      });
      const found = await service.findById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('increments total count after creation', async () => {
      const before = (await service.findAll()).total;
      await service.create({
        message: 'fix: bump with enough length for validation',
        repo: 'repo',
        hash: 'abcdef123459',
        authorId: 'user-1',
      });
      const after = (await service.findAll()).total;
      expect(after).toBe(before + 1);
    });

    it('throws 409 AppError for duplicate hash', async () => {
      const msg = 'feat: unique message for duplication test';
      await service.create({ message: msg, repo: 'repo', hash: 'hash123', authorId: 'user-1' });
      await expect(
        service.create({ message: 'feat: another message', repo: 'repo', hash: 'hash123', authorId: 'user-1' }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ---- remove ----
  describe('remove()', () => {
    it('removes a commit so it can no longer be found', async () => {
      await service.remove('commit-1');
      await expect(service.findById('commit-1'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 AppError for a non-existent id', async () => {
      await expect(service.remove('nonexistent'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('decrements total count after removal', async () => {
      const before = (await service.findAll()).total;
      await service.remove('commit-1');
      const after = (await service.findAll()).total;
      expect(after).toBe(before - 1);
    });
  });
});