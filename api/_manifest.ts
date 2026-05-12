import { deleteBlob, readManifestSnapshot, writeManifest } from "./_storage.js";
import type { Manifest, TasteItem } from "../src/lib/types.js";

const MAX_MUTATION_ATTEMPTS = 5;

let manifestQueue: Promise<unknown> = Promise.resolve();

export class ManifestConflictError extends Error {
  constructor(message = "Manifest changed while writing") {
    super(message);
    this.name = "ManifestConflictError";
  }
}

export async function mutateManifest<T>(
  apply: (manifest: Manifest) => { manifest: Manifest; result: T } | Promise<{ manifest: Manifest; result: T }>
): Promise<T> {
  return withManifestQueue(async () => {
    for (let attempt = 1; attempt <= MAX_MUTATION_ATTEMPTS; attempt++) {
      const snapshot = await readManifestSnapshot();
      const { manifest, result } = await apply(cloneManifest(snapshot.manifest));

      try {
        await writeManifest(manifest, {
          ifMatch: snapshot.etag,
          overwrite: !!snapshot.etag,
        });
        return result;
      } catch (error) {
        if (!isManifestConflict(error) || attempt === MAX_MUTATION_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new ManifestConflictError();
  });
}

export async function prependItems(items: TasteItem[]): Promise<TasteItem[]> {
  return mutateManifest((manifest) => {
    const incoming = new Map(items.map((item) => [item.id, item]));
    const dedupedExisting = manifest.items.filter((item) => !incoming.has(item.id));
    return {
      manifest: { items: [...items, ...dedupedExisting] },
      result: items,
    };
  });
}

export async function removeItem(id: string): Promise<{ removed: TasteItem; remaining: Manifest }> {
  return mutateManifest((manifest) => {
    const removed = manifest.items.find((item) => item.id === id);
    if (!removed) {
      throw new ManifestConflictError("Item not found");
    }
    const remaining = { items: manifest.items.filter((item) => item.id !== id) };
    return {
      manifest: remaining,
      result: { removed, remaining },
    };
  });
}

export async function mergeLegacyManifestPut(incoming: Manifest): Promise<Manifest> {
  return mutateManifest((current) => {
    const currentById = new Set(current.items.map((item) => item.id));
    const incomingById = new Map(incoming.items.map((item) => [item.id, item]));
    const newIncoming = incoming.items.filter((item) => !currentById.has(item.id));
    const mergedExisting = current.items.map((item) => incomingById.get(item.id) ?? item);
    const merged = { items: [...newIncoming, ...mergedExisting] };
    return { manifest: merged, result: merged };
  });
}

export function assetUrls(item: TasteItem): string[] {
  return [item.image, item.thumb, item.video].filter(
    (url): url is string => !!url && (url.startsWith("http") || url.startsWith("/local-blob/"))
  );
}

export async function deleteUnreferencedAssets(item: TasteItem, manifest: Manifest): Promise<void> {
  const remainingUrls = new Set(manifest.items.flatMap(assetUrls));
  const urlsToDelete = [...new Set(assetUrls(item))].filter((url) => !remainingUrls.has(url));
  await Promise.all(urlsToDelete.map(deleteBlob));
}

function cloneManifest(manifest: Manifest): Manifest {
  return { items: manifest.items.map((item) => ({ ...item, tags: [...item.tags] })) };
}

function withManifestQueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = manifestQueue.then(operation, operation);
  manifestQueue = run.catch(() => {});
  return run;
}

function isManifestConflict(error: unknown): boolean {
  if (error instanceof ManifestConflictError) return true;
  if (!(error instanceof Error)) return false;
  return /precondition|already exists|conflict/i.test(error.message);
}
