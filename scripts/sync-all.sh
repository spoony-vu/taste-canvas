#!/bin/bash
# Bidirectional sync: push local → Blob, then pull Blob → local
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Load env
set -a
source .env.local
set +a

echo "[$(date)] Starting bidirectional sync..."

# Push local items to Blob (uploads new images, updates manifest)
npx tsx scripts/push.ts

# Pull any cloud-only items back to local vault
npx tsx scripts/sync.ts

echo "[$(date)] Sync complete."
