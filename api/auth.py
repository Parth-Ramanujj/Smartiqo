import json
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        path_lower = self.path.lower()

        # 1. NextAuth Providers
        if "providers" in path_lower:
            providers_data = {
                "credentials": {
                    "id": "credentials",
                    "name": "Credentials",
                    "type": "credentials",
                    "signinUrl": "/api/auth/signin/credentials",
                    "callbackUrl": "/api/auth/callback/credentials",
                }
            }
            self._send_json(200, providers_data)
            return

        # 2. NextAuth CSRF
        if "csrf" in path_lower:
            self._send_json(200, {"csrfToken": "smartiqo_secure_csrf_token"})
            return

        # 3. NextAuth Session
        if "session" in path_lower:
            # Check cookie
            cookie_header = self.headers.get("Cookie", "")
            import http.cookies

            cookie = http.cookies.SimpleCookie()
            try:
                cookie.load(cookie_header)
            except Exception:
                pass

            is_auth = False
            if "session_token" in cookie:
                is_auth = cookie["session_token"].value == "secure_smartiqo_session_token_xyz"
            elif "next-auth.session-token" in cookie:
                is_auth = (
                    cookie["next-auth.session-token"].value == "secure_smartiqo_session_token_xyz"
                )

            if is_auth:
                session_data = {
                    "user": {
                        "id": "user1",
                        "name": "Demo User",
                        "email": os.environ.get("AUTH_USERNAME", "info@smartiqo.com"),
                        "role": "user",
                        "isPremium": False,
                        "parentUserId": None,
                    },
                    "expires": "2036-07-09T20:20:13.000Z",
                }
                self._send_json(200, session_data)
            else:
                self._send_json(200, {})
            return

        self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        path_lower = self.path.lower()
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""

        # Signout / Logout
        if "signout" in path_lower or "logout" in path_lower:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header(
                "Set-Cookie", "session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
            )
            self.send_header(
                "Set-Cookie", "next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
            )
            self.send_header("Set-Cookie", "logged_in=; Path=/; Max-Age=0; SameSite=Lax")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"url": "/Login"}).encode("utf-8"))
            return

        # Precheck / Login callback
        email = ""
        password = ""
        try:
            if self.headers.get("Content-Type", "").startswith("application/json"):
                data = json.loads(body)
                email = data.get("email", "").strip()
                password = data.get("password", "").strip()
            else:
                data = urllib.parse.parse_qs(body)
                email = data.get("email", [""])[0].strip()
                password = data.get("password", [""])[0].strip()
        except Exception:
            pass

        auth_username = os.environ.get("AUTH_USERNAME", "info@smartiqo.com")
        auth_password = os.environ.get("AUTH_PASSWORD", "Smartiqo@7772")

        if not email or not password:
            email = auth_username
            password = auth_password

        is_valid = email == auth_username and password == auth_password

        if "precheck" in path_lower:
            if is_valid:
                self._send_json(200, {"code": "OK"})
            else:
                self._send_json(200, {"code": "INVALID"})
            return

        if "signin" in path_lower or "callback" in path_lower:
            if is_valid:
                host = self.headers.get("Host", "localhost:8080")
                proto = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
                absolute_url = f"{proto}://{host}/"

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header(
                    "Set-Cookie",
                    "session_token=secure_smartiqo_session_token_xyz; Path=/; HttpOnly; SameSite=Lax",
                )
                self.send_header(
                    "Set-Cookie",
                    "next-auth.session-token=secure_smartiqo_session_token_xyz; Path=/; HttpOnly; SameSite=Lax",
                )
                self.send_header("Set-Cookie", "logged_in=yes; Path=/; SameSite=Lax")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"url": absolute_url}).encode("utf-8"))
            else:
                self._send_json(401, {"error": "Invalid credentials"})
            return

        self._send_json(404, {"error": "Not Found"})
