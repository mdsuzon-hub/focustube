import { LIMITS } from './defaults';
import { sanitizeQueue, sanitizeSettings, sanitizeTopic, migrateSettings } from './sanitize';
import type { Queue, Settings, Topic } from './types';
import { isRecord } from './util';

export const EXPORT_APP = 'focustube';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: typeof EXPORT_APP;
  exportVersion: number;
  exportedAt: string;
  settings: Settings;
  topics: Topic[];
  queues: Queue[];
}

export interface ImportResult {
  ok: boolean;
  errors: string[];
  settings?: Settings;
  topics?: Topic[];
  queues?: Queue[];
}

export function buildExport(
  settings: Settings,
  topics: Topic[],
  queues: Queue[],
  now: Date,
): ExportFile {
  return {
    app: EXPORT_APP,
    exportVersion: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    settings,
    topics,
    queues,
  };
}

/**
 * Parses and validates an import file. The input is only ever treated as data:
 * JSON.parse, then every field is re-validated by the same sanitizers used for storage.
 */
export function parseImport(json: string): ImportResult {
  if (json.length > LIMITS.importBytes)
    return { ok: false, errors: ['File is too large to import.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  if (!isRecord(raw) || raw.app !== EXPORT_APP) {
    return { ok: false, errors: ['This is not a FocusTube export file.'] };
  }
  if (typeof raw.exportVersion !== 'number' || raw.exportVersion > EXPORT_VERSION) {
    return { ok: false, errors: ['This export was made by a newer version of FocusTube.'] };
  }
  const errors: string[] = [];
  const result: ImportResult = { ok: true, errors };

  if (raw.settings !== undefined) {
    result.settings = isRecord(raw.settings)
      ? migrateSettings(raw.settings)
      : sanitizeSettings(undefined);
    if (!isRecord(raw.settings)) errors.push('Settings were malformed and were skipped.');
  }
  if (raw.topics !== undefined) {
    const list = Array.isArray(raw.topics) ? raw.topics : [];
    const topics = list
      .map(sanitizeTopic)
      .filter((t): t is Topic => t !== null)
      .slice(0, LIMITS.topics);
    if (topics.length < list.length)
      errors.push(`${list.length - topics.length} invalid topic(s) were skipped.`);
    result.topics = topics;
  }
  if (raw.queues !== undefined) {
    const list = Array.isArray(raw.queues) ? raw.queues : [];
    const queues = list
      .map(sanitizeQueue)
      .filter((q): q is Queue => q !== null)
      .slice(0, LIMITS.queues);
    if (queues.length < list.length)
      errors.push(`${list.length - queues.length} invalid queue(s) were skipped.`);
    result.queues = queues;
  }
  if (!result.settings && !result.topics && !result.queues) {
    return { ok: false, errors: ['The file contains nothing to import.'] };
  }
  return result;
}
