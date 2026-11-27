"""Verify seeded incident data via API."""
import urllib.request, json

# Summary
r = urllib.request.urlopen("http://127.0.0.1:8003/api/incidents/summary", timeout=5)
print("=== SUMMARY ===")
print(json.dumps(json.loads(r.read()), indent=2))

# List
r = urllib.request.urlopen("http://127.0.0.1:8003/api/incidents", timeout=5)
incidents = json.loads(r.read())
print(f"\n=== LIST: {len(incidents)} total incidents ===")
for i in incidents[:5]:
    print(f'  [{i["status"]}] {i["title"][:80]} | {i["origin"]} | {i["branch"]}')
print("  ...")