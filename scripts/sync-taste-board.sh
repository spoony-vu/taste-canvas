#!/bin/bash
# Sync production Taste Canvas manifest to Obsidian wiki
# Run via launchd daily or manually: ./scripts/sync-taste-board.sh

set -euo pipefail

export $(cat ~/.config/taste-canvas/config | xargs)

WIKI_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu"
OUTPUT="$WIKI_DIR/taste-board.md"

curl -sf -H "Authorization: Bearer $TASTE_API_KEY" "$API_URL/api/manifest" | python3 -c "
import sys, json
from collections import defaultdict
from datetime import date

data = json.load(sys.stdin)
items = data['items']

labels = {
    'typeface': 'Typeface', 'symbol': 'Symbol', 'landing-pages': 'Landing Pages',
    'interactions': 'Interactions', 'color-palette': 'Color Palette', 'patterns': 'Patterns',
    'branding': 'Branding', 'ui': 'UI', 'graphics': 'Graphics'
}

grouped = defaultdict(list)
for item in items:
    if not item.get('hidden'):
        grouped[item['category']].append(item)

lines = [
    '---',
    'tags: [taste, design, reference]',
    f'updated: {date.today().isoformat()}',
    '---',
    '',
    '# Taste Board',
    '',
    f'{len(items)} items across {len(grouped)} categories.',
    '',
]

for cat, cat_items in grouped.items():
    lines.append(f'## {labels.get(cat, cat)}')
    lines.append('')
    for item in cat_items:
        title = item['title']
        url = item.get('url', '')
        link = f'[{title}]({url})' if url else title
        tags = item.get('tags', [])
        tag_str = (' — ' + ', '.join(tags)) if tags else ''
        added = item.get('added', '')
        lines.append(f'- {link}{tag_str} *({added})*')
    lines.append('')

print('\n'.join(lines))
" > "$OUTPUT"

echo "Synced $(grep -c '^\- ' "$OUTPUT") items to $OUTPUT"
