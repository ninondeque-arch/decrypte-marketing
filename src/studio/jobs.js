// File de tâches du studio. Les tâches Claude Code passent une par une
// (elles écrivent dans les mêmes fichiers) ; les autres partent tout de suite.
import { randomUUID } from 'node:crypto';

const jobs = new Map();
let agentChain = Promise.resolve();

/**
 * @param {{kind: string, label: string, agent?: boolean, meta?: object}} info
 * @param {(log: (msg: string) => void) => Promise<any>} fn
 */
export function startJob({ kind, label, agent = false, meta = {} }, fn) {
  const job = { id: randomUUID(), kind, label, meta, status: agent ? 'en attente' : 'en cours', logs: [], result: null, error: null, startedAt: null, endedAt: null };
  jobs.set(job.id, job);
  const log = msg => { job.logs.push(msg); if (job.logs.length > 400) job.logs.shift(); };
  const run = async () => {
    job.status = 'en cours';
    job.startedAt = Date.now();
    try { job.result = await fn(log); job.status = 'terminé'; }
    catch (e) { job.error = e.message; job.status = 'échec'; }
    finally { job.endedAt = Date.now(); }
  };
  if (agent) agentChain = agentChain.then(run);
  else run();
  return job;
}

export const getJob = id => jobs.get(id);

/** Tâches en cours ou récentes (moins d'une heure), les plus récentes d'abord. */
export function recentJobs() {
  const hour = Date.now() - 3600_000;
  return [...jobs.values()].filter(j => !j.endedAt || j.endedAt > hour).reverse()
    .map(({ logs, ...j }) => ({ ...j, lastLog: logs.at(-1) ?? '' }));
}

export const isRunning = predicate => [...jobs.values()].some(j => !j.endedAt && predicate(j));
