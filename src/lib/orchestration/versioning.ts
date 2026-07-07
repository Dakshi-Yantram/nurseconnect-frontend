/**
 * Phase 4 — Versioning + Draft/Publish Foundations.
 *
 * Lightweight version-aware metadata applied to authored artefacts
 * (care packages, clinical rule sets, documentation templates). Full diffing
 * is intentionally deferred — this layer establishes the shape and helpers.
 */
export type VersionStage = "draft" | "published" | "archived";

export interface VersionedDoc<T = unknown> {
  key: string;             // logical id (stable across versions)
  version: number;         // monotonically increasing
  stage: VersionStage;
  updatedAt: string;       // ISO
  updatedBy: string;
  body: T;
  parentVersion?: number;
}

const EMPTY_VERSIONS: VersionedDoc<any>[] = Object.freeze([]) as any;

export class VersionStore<T = unknown> {
  private docs = new Map<string, VersionedDoc<T>[]>();
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
  private notify() { this.listeners.forEach(l => l()); }

  // Stable reference required for useSyncExternalStore — return shared empty
  // when no versions exist, otherwise the stored array (mutated in place
  // only via saveDraft replacement / publish stage changes, which call notify()).
  list(key: string): VersionedDoc<T>[] { return this.docs.get(key) ?? (EMPTY_VERSIONS as VersionedDoc<T>[]); }
  latest(key: string, stage?: VersionStage): VersionedDoc<T> | undefined {
    const all = this.list(key).slice().sort((a, b) => b.version - a.version);
    return stage ? all.find(d => d.stage === stage) : all[0];
  }
  published(key: string) { return this.latest(key, "published"); }
  draft(key: string)     { return this.latest(key, "draft"); }

  saveDraft(key: string, body: T, updatedBy: string): VersionedDoc<T> {
    const prev = this.latest(key);
    // If newest revision is already a draft, mutate it in place (avoid version sprawl).
    if (prev && prev.stage === "draft") {
      prev.body = body;
      prev.updatedAt = new Date().toISOString();
      prev.updatedBy = updatedBy;
      this.notify();
      return prev;
    }
    const doc: VersionedDoc<T> = {
      key, version: (prev?.version ?? 0) + 1,
      stage: "draft", updatedAt: new Date().toISOString(),
      updatedBy, body, parentVersion: prev?.version,
    };
    const arr = this.docs.get(key) ?? [];
    arr.push(doc);
    this.docs.set(key, arr);
    this.notify();
    return doc;
  }
  publish(key: string, updatedBy: string): VersionedDoc<T> | undefined {
    const d = this.draft(key);
    if (!d) return undefined;
    const arr = this.docs.get(key)!;
    for (const v of arr) if (v.stage === "published" && v.version !== d.version) v.stage = "archived";
    d.stage = "published";
    d.updatedAt = new Date().toISOString();
    d.updatedBy = updatedBy;
    this.notify();
    return d;
  }
  /** Seed a published baseline (used when an editor opens for the first time). */
  seedPublished(key: string, body: T, updatedBy = "system"): VersionedDoc<T> {
    if (this.latest(key)) return this.latest(key)!;
    const doc: VersionedDoc<T> = {
      key, version: 1, stage: "published",
      updatedAt: new Date().toISOString(), updatedBy, body,
    };
    this.docs.set(key, [doc]);
    this.notify();
    return doc;
  }
}
