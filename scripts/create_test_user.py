"""Register a test user and get a token."""
import urllib.request, json

base = "http://127.0.0.1:8002"

# 1. Register
payload = json.dumps({"email": "admin@nexova.com", "password": "admin123"}).encode()
req = urllib.request.Request(f"{base}/users", data=payload, headers={"Content-Type": "application/json"})
try:
    r = urllib.request.urlopen(req, timeout=5)
    print(f"Register: {r.status} — {r.read().decode()[:120]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Register: {e.code} — {body[:150]}")

# 2. Login
payload2 = json.dumps({"email": "admin@nexova.com", "password": "admin123"}).encode()
req2 = urllib.request.Request(f"{base}/auth/login", data=payload2, headers={"Content-Type": "application/json"})
try:
    r2 = urllib.request.urlopen(req2, timeout=5)
    data = json.loads(r2.read())
    token = data["access_token"]
    print(f"\nLogin OK. Token (first 60 chars): {token[:60]}...")
    # Save token to a file for the browser
    with open("nexova_token.txt", "w") as f:
        f.write(token)
    print("Token saved to nexova_token.txt")
except urllib.error.HTTPError as e:
    print(f"Login error: {e.code} — {e.read().decode()[:200]}")