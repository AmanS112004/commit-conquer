/**
 * packages/server/src/services/commitService.ts
 */

import { AppError } from '../middleware/errorHandler';

export interface Commit {
  id: string;
  hash: string;
  message: string;
  repo: string;
  authorId?: string;
  points: number;
  createdAt: Date;
}

const POINT_MAP: Record<string, number> = {
  feat:     10,
  fix:       8,
  perf:      7,
  refactor:  6,
  test:      5,
  ci:        4,
  docs:      3,
  style:     2,
  chore:     2,
};

const DUMMY_WORDS = ["test", "dummy", "fix", "msg", "asdf", "qwerty", "placeholder"];

export interface ValidationResult {
  points: number;
  isValid: boolean;
  reason?: string;
}

export function validateAndCalculatePoints(message: string): ValidationResult {
  if (!message || message.trim().length < 5) {
    return { points: 0, isValid: false, reason: "Message too short" };
  }

  const match = message.match(/^([a-zA-Z]+)(\([^)]+\))?!?: (.*)$/);
  if (!match) {
    return { points: 1, isValid: true }; // Allow non-conventional but with low points
  }

  const type = match[1].toLowerCase();
  const scope = match[2];
  const description = match[3].trim();

  // Basic "farming" detection
  if (description.length < 10) {
    return { points: 0, isValid: false, reason: "Description too short (min 10 chars)" };
  }

  const isDummy = DUMMY_WORDS.some(word => description.toLowerCase() === word || description.toLowerCase().includes("test"));
  if (isDummy && description.length < 15) {
    return { points: 0, isValid: false, reason: "Dummy message detected" };
  }

  let points = POINT_MAP[type] ?? 1;
  
  // Bonus for scope
  if (scope) points += 2;

  // Bonus for length (rewarding descriptive messages)
  if (description.length > 50) points += 5;
  else if (description.length > 30) points += 2;

  return { points, isValid: true };
}

// Module-level in-memory store.
let store: Commit[] = [];
let idCounter = 0;

export class CommitService {
  /** Test helper — resets the store to a known state. */
  _reset(data: Commit[]): void {
    store = data;
    idCounter = data.length;
  }

  async findAll(opts?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: Commit[]; total: number }> {
    const page  = opts?.page  ?? 1;
    const limit = opts?.limit ?? 10;
    const offset = (page - 1) * limit;

    return {
      data:  store.slice(offset, offset + limit),
      total: store.length,
    };
  }

  async findById(id: string): Promise<Commit> {
    const commit = store.find((c) => c.id === id);
    if (!commit) throw new AppError(`Commit ${id} not found`, 404);
    return commit;
  }

  async create(data: {
    message: string;
    repo: string;
    hash: string;
    authorId?: string;
  }): Promise<Commit> {
    const { message, repo, hash, authorId } = data;

    // 1. Validation
    const validation = validateAndCalculatePoints(message);
    if (!validation.isValid) {
      throw new AppError(validation.reason || "Invalid commit message", 400);
    }

    // 2. Deduplication (Check by hash OR same message by same author)
    const isDuplicate = store.some(c => 
      c.hash === hash || 
      (c.message === message && c.authorId === authorId && c.repo === repo)
    );
    if (isDuplicate) {
      throw new AppError("Commit already submitted", 409);
    }

    // 3. Simulated Remote Verification (checking GitHub/GitLab)
    await new Promise(r => setTimeout(r, 500)); 
    if (hash.length < 7) {
      throw new AppError("Invalid commit hash format", 400);
    }

    const commit: Commit = {
      id:        `commit-${++idCounter}`,
      hash,
      message,
      repo,
      authorId,
      points:    validation.points,
      createdAt: new Date(),
    };

    store.push(commit);
    return commit;
  }

  async remove(id: string): Promise<void> {
    const index = store.findIndex((c) => c.id === id);
    if (index === -1) throw new AppError(`Commit ${id} not found`, 404);
    store.splice(index, 1);
  }
}
