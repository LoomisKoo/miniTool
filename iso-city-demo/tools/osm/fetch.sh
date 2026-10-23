#!/usr/bin/env bash
# 逐个拉四份原始数据。公共 Overpass 经常 502，所以要重试；
# 拆成四个小查询的成功率比一次拉全城高得多。
set -u
cd "$(dirname "$0")/../.."
mkdir -p tools/osm/raw
for part in buildings roads water areas; do
  [ -s "tools/osm/raw/$part.json" ] && { echo "skip $part"; continue; }
  for attempt in 1 2 3 4 5 6 7 8; do
    curl -s -m 240 -A "iso-city-demo/1.0" \
      -X POST --data-urlencode "data@tools/osm/query/$part.txt" \
      https://overpass-api.de/api/interpreter -o "tools/osm/raw/$part.json"
    if head -c 1 "tools/osm/raw/$part.json" | grep -q '{'; then
      echo "ok $part ($(wc -c < "tools/osm/raw/$part.json") bytes)"
      break
    fi
    echo "retry $part (#$attempt)"
    sleep $((attempt * 10))
  done
done
node tools/osm/overpass-to-city.mjs --out src/data/osm-city.json \
  --in tools/osm/raw/buildings.json --in tools/osm/raw/roads.json \
  --in tools/osm/raw/water.json --in tools/osm/raw/areas.json
