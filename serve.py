#!/usr/bin/env python3
"""Production-ready HTTP server for the cloned website.

Serves static Next.js clone with:
- Threaded request handling
- Request logging
- SPA routing (index.html for unknown paths)
- Next.js image optimization interception
- API mocking from crawled JSON
- Graceful shutdown
- Config via environment variables
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import os
import sys
import json
import signal
import logging
import urllib.parse
<<<<<<< HEAD
import uuid
=======
>>>>>>> 16291ab (Initial project import)
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("serve")

DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")

<<<<<<< HEAD
# ─── Multi-user session store ─────────────────────────────────────────────────
# sessions: { token_string -> {email, name, role, id} }
SESSIONS = {}

def _load_users():
    """Load users from users.json, falling back to env-var single user."""
    users_file = DIR / "users.json"
    users = {}
    if users_file.exists():
        try:
            data = json.loads(users_file.read_text(encoding="utf-8"))
            for u in data.get("users", []):
                email = u.get("email", "").strip().lower()
                if email:
                    users[email] = u
            logger.info("Loaded %d users from users.json", len(users))
            return users
        except Exception as e:
            logger.error("Failed to load users.json: %s", e)
    # Fallback: single user from env
    email = os.environ.get("AUTH_USERNAME", "info@smartiqo.com").lower()
    users[email] = {
        "email": email,
        "password": os.environ.get("AUTH_PASSWORD", "Smartiqo@7772"),
        "name": "Admin",
        "role": "admin",
        "id": "user_001",
    }
    return users

USERS = _load_users()

def _authenticate(email, password):
    """Validate credentials; return user dict or None."""
    user = USERS.get(email.strip().lower())
    if user and user.get("password", "") == password.strip():
        return user
    return None

def _create_session(user):
    """Generate a unique session token for this user and store it."""
    token = str(uuid.uuid4()).replace("-", "")
    SESSIONS[token] = {
        "email": user["email"],
        "name": user.get("name", user["email"]),
        "role": user.get("role", "user"),
        "id": user.get("id", user["email"]),
    }
    return token

def _get_session(token):
    """Return session data for token, or None."""
    return SESSIONS.get(token)

=======
>>>>>>> 16291ab (Initial project import)

def load_env():
    env_path = DIR.parent / ".env"
    if not env_path.exists():
        env_path = DIR / ".env"
    if env_path.exists():
        logger.info("Loading environment variables from %s", env_path)
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip("'\"")


API_MOCK_DIR = DIR / "api-static"
PAGES_DIR = DIR / "pages"
<<<<<<< HEAD
CART_DATA_DIR = DIR / "cart-data"
CART_DATA_DIR.mkdir(exist_ok=True)
=======
>>>>>>> 16291ab (Initial project import)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class CORSHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def log_message(self, format, *args):
        logger.info("%s - %s", self.client_address[0], format % args)

    def do_HEAD(self):
        self.send_cors_headers()
        super().do_HEAD()

    def _read_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length:
            return self.rfile.read(content_length).decode("utf-8")
        return "{}"

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def handle_api_method(self, method):
        if not self.path.startswith("/api/"):
            self.send_error(501, f"Unsupported method: {method}")
            return

        path = self.path
        path_lower = path.lower()

<<<<<<< HEAD
        # ── Auth: precheck ─────────────────────────────────────────────────────
=======
        # Secure Authentication precheck and signin/callback API mocks
>>>>>>> 16291ab (Initial project import)
        if "api/auth/precheck" in path_lower:
            body = self._read_body()
            try:
                data = json.loads(body)
<<<<<<< HEAD
                email = data.get("email", "").strip().lower()
                password = data.get("password", "").strip()
                user = _authenticate(email, password)
                self._send_json(200, {"code": "OK" if user else "INVALID"})
=======
                email = data.get("email", "").strip()
                password = data.get("password", "").strip()

                auth_username = os.environ.get("AUTH_USERNAME", "info@smartiqo.com")
                auth_password = os.environ.get("AUTH_PASSWORD", "Smartiqo@7772")

                if email == auth_username and password == auth_password:
                    self._send_json(200, {"code": "OK"})
                else:
                    self._send_json(200, {"code": "INVALID"})
>>>>>>> 16291ab (Initial project import)
            except Exception as e:
                logger.error("Precheck error: %s", e)
                self._send_json(200, {"code": "INVALID"})
            return

<<<<<<< HEAD
        # ── Auth: signin / callback ───────────────────────────────────────────
        if "/api/auth/signin" in path_lower or "/api/auth/callback" in path_lower:
            body = self._read_body()
            try:
=======

        if "/api/auth/signin" in path_lower or "/api/auth/callback" in path_lower:
            body = self._read_body()
            try:
                import urllib.parse
>>>>>>> 16291ab (Initial project import)
                email = ""
                password = ""
                if self.headers.get("Content-Type", "").startswith("application/json"):
                    data = json.loads(body)
                    email = data.get("email", "").strip()
                    password = data.get("password", "").strip()
                else:
                    data = urllib.parse.parse_qs(body)
                    email = data.get("email", [""])[0].strip()
                    password = data.get("password", [""])[0].strip()

<<<<<<< HEAD
                # Allow empty credentials → fallback to first user (demo mode)
                if not email or not password:
                    first = next(iter(USERS.values()), None)
                    if first:
                        email = first["email"]
                        password = first["password"]

                user = _authenticate(email, password)
                if user:
                    token = _create_session(user)
=======
                auth_username = os.environ.get("AUTH_USERNAME", "info@smartiqo.com")
                auth_password = os.environ.get("AUTH_PASSWORD", "Smartiqo@7772")
                
                if not email or not password:
                    email = auth_username
                    password = auth_password

                user_role = None
                user_name = "User"
                
                # Check users.json
                users_path = DIR / "users.json"
                if users_path.exists():
                    try:
                        users = json.loads(users_path.read_text(encoding="utf-8"))
                        for u in users:
                            if u.get("email") == email and u.get("password") == password:
                                user_role = u.get("role", "user")
                                user_name = u.get("name", "User")
                                break
                    except:
                        pass
                
                # Fallback to env
                if not user_role and email == auth_username and password == auth_password:
                    user_role = "user"

                if user_role:
>>>>>>> 16291ab (Initial project import)
                    host = self.headers.get("Host", "localhost:8080")
                    proto = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
                    absolute_url = f"{proto}://{host}/"

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
<<<<<<< HEAD
                    self.send_header("Set-Cookie",
                        f"session_token={token}; Path=/; HttpOnly; SameSite=Lax")
                    self.send_header("Set-Cookie",
                        f"next-auth.session-token={token}; Path=/; HttpOnly; SameSite=Lax")
                    self.send_header("Set-Cookie", "logged_in=yes; Path=/; SameSite=Lax")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({"url": absolute_url}).encode("utf-8"))
                    logger.info("User logged in: %s", user["email"])
=======
                    self.send_header("Set-Cookie", "session_token=secure_smartiqo_session_token_xyz; Path=/; HttpOnly; SameSite=Lax")
                    self.send_header("Set-Cookie", "next-auth.session-token=secure_smartiqo_session_token_xyz; Path=/; HttpOnly; SameSite=Lax")
                    self.send_header("Set-Cookie", "logged_in=yes; Path=/; SameSite=Lax")
                    self.send_header("Set-Cookie", f"auth_email={email}; Path=/; SameSite=Lax")
                    self.send_header("Set-Cookie", f"auth_role={user_role}; Path=/; SameSite=Lax")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({"url": absolute_url}).encode("utf-8"))
>>>>>>> 16291ab (Initial project import)
                else:
                    self._send_json(401, {"error": "Invalid credentials"})
            except Exception as e:
                logger.error("Signin error: %s", e)
                self._send_json(401, {"error": "Authentication failed"})
            return

<<<<<<< HEAD
        # ── Auth: signout ─────────────────────────────────────────────────────
        if "/api/auth/signout" in path_lower or "/api/auth/logout" in path_lower:
            # Invalidate session
            cookie_header = self.headers.get("Cookie", "")
            import http.cookies
            cookie = http.cookies.SimpleCookie()
            try:
                cookie.load(cookie_header)
            except Exception:
                pass
            token = cookie.get("session_token", None)
            if token:
                SESSIONS.pop(token.value, None)
                logger.info("Session %s invalidated", token.value[:8])

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", "session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
            self.send_header("Set-Cookie", "next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
=======
        if "/api/auth/signout" in path_lower or "/api/auth/logout" in path_lower:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header(
                "Set-Cookie", "session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
            )
            self.send_header(
                "Set-Cookie", "next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
            )
>>>>>>> 16291ab (Initial project import)
            self.send_header("Set-Cookie", "logged_in=; Path=/; Max-Age=0; SameSite=Lax")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"url": "/Login"}).encode("utf-8"))
            return
        if "icons/upload" in path and method == "POST":
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" in content_type:
                boundary_idx = content_type.find("boundary=")
                if boundary_idx != -1:
                    boundary = b"--" + content_type[boundary_idx + 9 :].encode("utf-8")
                    content_length = int(self.headers.get("Content-Length", 0))
                    raw_body = self.rfile.read(content_length)

                    parts = raw_body.split(boundary)
                    file_data = None
                    filename = "custom.svg"
                    category = "Decorative lights"

                    import re

                    for part in parts:
                        if not part or part == b"--\r\n" or part == b"--":
                            continue
                        header_body = part.split(b"\r\n\r\n", 1)
                        if len(header_body) < 2:
                            continue
                        part_headers, part_body = header_body
                        part_headers_str = part_headers.decode("utf-8", errors="ignore")

                        if 'name="category"' in part_headers_str:
                            if part_body.endswith(b"\r\n"):
                                part_body = part_body[:-2]
                            category = part_body.decode("utf-8", errors="ignore").strip()

                        if 'name="icon"' in part_headers_str:
                            fn_match = re.search(r'filename="([^"]+)"', part_headers_str)
                            if fn_match:
                                filename = fn_match.group(1)
                            if part_body.endswith(b"\r\n"):
                                part_body = part_body[:-2]
                            file_data = part_body

                    if file_data:
                        ext = ".svg"
                        if "." in filename:
                            ext = os.path.splitext(filename)[1].lower()
                            if ext not in (".svg", ".png", ".jpg", ".jpeg"):
                                ext = ".svg"

                        target_dir = DIR / "icon" / "dynamic" / "My_Icons"
                        target_dir.mkdir(parents=True, exist_ok=True)

                        import uuid

                        new_id = str(uuid.uuid4())
                        file_name = f"custom_{new_id[:8]}{ext}"
                        target_file = target_dir / file_name
                        target_file.write_bytes(file_data)

                        # Save to metadata.json
                        metadata_file = target_dir / "metadata.json"
                        metadata = {}
                        if metadata_file.exists():
                            try:
                                with open(metadata_file, "r", encoding="utf-8") as f:
                                    metadata = json.load(f)
                            except Exception:
                                pass

                        clean_name = (
                            os.path.splitext(filename)[0]
                            .replace("_", " ")
                            .replace("-", " ")
                            .title()
                        )
                        metadata[file_name] = {
                            "id": new_id,
                            "name": clean_name,
                            "category": category,
                        }

                        try:
                            with open(metadata_file, "w", encoding="utf-8") as f:
                                json.dump(metadata, f, indent=2)
                        except Exception as e:
                            logger.error("Failed to write metadata: %s", e)

                        icon_url = f"/icon/dynamic/My_Icons/{file_name}"
                        logger.info("Custom icon uploaded successfully to %s", target_file)
                        self._send_json(
                            200,
                            {
                                "id": new_id,
                                "category": category,
                                "url": icon_url,
                                "name": clean_name,
                                "imageUrl": icon_url,
                            },
                        )
                        return
            self.send_error(400, "Bad upload request")
            return

<<<<<<< HEAD
=======
        
        if "config/google-sheet-url" in path_lower and method in ("POST", "PUT"):
            try:
                body = self._read_body()
                data = json.loads(body)
                cfg_path = DIR / "config.json"
                cfg = {}
                if cfg_path.exists():
                    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
                cfg["googleSheetUrl"] = data.get("url", "")
                cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
                self._send_json(200, {"success": True})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if "admin/users" in path_lower and method in ("POST", "PUT"):
            try:
                body = self._read_body()
                data = json.loads(body)
                users_path = DIR / "users.json"
                users = []
                if users_path.exists():
                    users = json.loads(users_path.read_text(encoding="utf-8"))
                users.append({
                    "email": data.get("email"),
                    "password": data.get("password"),
                    "role": data.get("role", "user"),
                    "name": data.get("name", "User")
                })
                users_path.write_text(json.dumps(users, indent=2), encoding="utf-8")
                self._send_json(200, {"success": True})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return
            
        if "admin/users" in path_lower and method == "DELETE":
            try:
                parsed = urllib.parse.urlparse(self.path)
                query = urllib.parse.parse_qs(parsed.query)
                email = query.get("email", [""])[0]
                users_path = DIR / "users.json"
                if users_path.exists():
                    users = json.loads(users_path.read_text(encoding="utf-8"))
                    users = [u for u in users if u.get("email") != email]
                    users_path.write_text(json.dumps(users, indent=2), encoding="utf-8")
                self._send_json(200, {"success": True})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

>>>>>>> 16291ab (Initial project import)
        body = self._read_body() if method in ("POST", "PUT", "PATCH") else "{}"
        path = self.path

        if "coupons/validate" in path:
            self._send_json(200, {"valid": True, "discount": 10, "message": "Coupon applied"})
        elif method in ("PUT", "PATCH") and "prices/" in path:
            self._send_json(200, {"success": True, **json.loads(body)})
        elif method in ("PUT", "PATCH") and "admin/orders/" in path:
            self._send_json(200, {"success": True, "status": "updated"})
        elif method in ("PUT", "PATCH") and "userSettings/" in path:
            self._send_json(200, {"success": True, **json.loads(body)})
        elif "sendPanelEmail" in path or "sendpanelemail" in path.lower():
            self._send_json(200, {"success": True, "message": "Email sent"})
        elif "orders" in path and method == "POST":
            self._send_json(
                200,
                {
                    "success": True,
                    "orderId": "ORD-" + str(hash(body))[:8],
                    "message": "Order created",
                },
            )
        elif "notifications" in path and "/status" in path:
            self._send_json(200, {"success": True})
        elif "offers" in path and ("/impression" in path or "/action" in path):
            self._send_json(200, {"success": True})
        elif "update-company-name" in path:
            self._send_json(
                200, {"success": True, "companyName": json.loads(body).get("companyName", "")}
            )
        elif "activity/update" in path or "/logs" in path:
            self._send_json(200, {"success": True})
        else:
            self._send_json(200, {"success": True})

    def _serve_dynamic_icons(self):
        # 1. Load static icons.json
        static_path = API_MOCK_DIR / "icons.json"
        icons_data = []
        if static_path.exists():
            try:
                with open(static_path, "r", encoding="utf-8") as f:
                    icons_data = json.load(f)
            except Exception as e:
                logger.error("Error reading static icons.json: %s", e)

        # 2. Read metadata of custom/uploaded icons
        metadata_path = DIR / "icon" / "dynamic" / "My_Icons" / "metadata.json"
        custom_icons = []
        if metadata_path.exists():
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

                # Check which files actually exist on disk
                for file_name, info in metadata.items():
                    file_path = DIR / "icon" / "dynamic" / "My_Icons" / file_name
                    if file_path.exists():
                        custom_icons.append(
                            {
                                "id": info.get("id"),
                                "categoryId": "custom-icons-category",
                                "categoryLabel": info.get("category", "Decorative lights"),
                                "name": info.get("name", "Custom Icon"),
                                "imageUrl": f"/icon/dynamic/My_Icons/{file_name}",
                            }
                        )
            except Exception as e:
                logger.error("Error reading icons metadata.json: %s", e)

        # 3. If there are custom icons, group them by category and append to icons_data
        if custom_icons:
            # Group by categoryLabel
            by_category = {}
            for icon in custom_icons:
                cat_label = icon["categoryLabel"]
                if cat_label not in by_category:
                    by_category[cat_label] = []
                by_category[cat_label].append(icon)

            # For each category, construct category object
            for cat_label, icons in by_category.items():
                # Check if this category already exists in static icons_data
                existing_cat = None
                for cat in icons_data:
                    if cat.get("categoryLabel") == cat_label:
                        existing_cat = cat
                        break

                if existing_cat:
                    # Append to existing category
                    # Ensure no duplicate IDs
                    existing_ids = {ic.get("id") for ic in existing_cat.get("icons", [])}
                    for ic in icons:
                        if ic["id"] not in existing_ids:
                            existing_cat.setdefault("icons", []).append(ic)
                else:
                    # Create new category
                    import hashlib

                    cat_id = hashlib.md5(cat_label.encode("utf-8")).hexdigest()
                    new_cat = {
                        "categoryId": cat_id,
                        "categoryLabel": cat_label,
                        "sortOrder": 99,
                        "icons": icons,
                    }
                    icons_data.append(new_cat)

        self._send_json(200, icons_data)

    def do_POST(self):
<<<<<<< HEAD
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path.rstrip("/") == "/api/cart" or parsed_path.startswith("/api/cart/"):
            self._handle_cart_api("POST")
            return
        if parsed_path.rstrip("/") in ("/api/user-orders", "/api/my-orders"):
            self._handle_user_orders_api("POST")
            return
        if parsed_path.rstrip("/") == "/api/sheet-sync":
            self._handle_sheet_sync("POST")
            return
        self.handle_api_method("POST")

    def do_PUT(self):
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path.rstrip("/") == "/api/cart" or parsed_path.startswith("/api/cart/"):
            self._handle_cart_api("PUT")
            return
        if parsed_path.rstrip("/") in ("/api/user-orders", "/api/my-orders"):
            self._handle_user_orders_api("PUT")
            return
        if parsed_path.rstrip("/") == "/api/sheet-sync":
            self._handle_sheet_sync("PUT")
            return
        self.handle_api_method("PUT")

    def do_PATCH(self):
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path.rstrip("/") == "/api/cart" or parsed_path.startswith("/api/cart/"):
            self._handle_cart_api("PATCH")
            return
        if parsed_path.rstrip("/") == "/api/sheet-sync":
            self._handle_sheet_sync("PATCH")
            return
        self.handle_api_method("PATCH")

    def do_DELETE(self):
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path.rstrip("/") == "/api/cart" or parsed_path.startswith("/api/cart/"):
            self._handle_cart_api("DELETE")
            return
        if parsed_path.rstrip("/") in ("/api/user-orders", "/api/my-orders"):
            self._handle_user_orders_api("DELETE")
            return
=======
        self.handle_api_method("POST")

    def do_PUT(self):
        self.handle_api_method("PUT")

    def do_PATCH(self):
        self.handle_api_method("PATCH")

    def do_DELETE(self):
>>>>>>> 16291ab (Initial project import)
        path = self.path
        if self.path.startswith("/api/"):
            if "icons/upload" in self.path:
                parsed = urllib.parse.urlparse(self.path)
                query = urllib.parse.parse_qs(parsed.query)
                icon_id = query.get("id", [""])[0]
                if icon_id:
                    # Find in metadata.json and delete
                    target_dir = DIR / "icon" / "dynamic" / "My_Icons"
                    metadata_file = target_dir / "metadata.json"
                    if metadata_file.exists():
                        try:
                            with open(metadata_file, "r", encoding="utf-8") as f:
                                metadata = json.load(f)

                            found_file = None
                            for file_name, info in metadata.items():
                                if info.get("id") == icon_id:
                                    found_file = file_name
                                    break

                            if found_file:
                                del metadata[found_file]
                                with open(metadata_file, "w", encoding="utf-8") as f:
                                    json.dump(metadata, f, indent=2)

                                file_path = target_dir / found_file
                                if file_path.exists():
                                    file_path.unlink()
                                logger.info("Deleted custom icon: %s (id: %s)", found_file, icon_id)
                        except Exception as e:
                            logger.error("Failed to delete custom icon: %s", e)
                self._send_json(200, {"success": True})
            else:
                self._send_json(200, {"success": True, "deleted": True})
        else:
            self.send_error(501, "Unsupported method")

    def _is_authenticated(self):
<<<<<<< HEAD
        import http.cookies
        cookie = http.cookies.SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            pass
        if "session_token" in cookie:
            return _get_session(cookie["session_token"].value) is not None
        return False

    def _get_current_user(self):
        """Return session data dict for the current request user, or None."""
        import http.cookies
        cookie = http.cookies.SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            pass
        if "session_token" in cookie:
            return _get_session(cookie["session_token"].value)
        return None

    def _get_cart_user_id(self):
        """Return a stable user identifier for cart storage (per-user email)."""
        user = self._get_current_user()
        if user:
            email = user.get("email", "").strip().lower()
            if email:
                import re
                return re.sub(r'[^a-zA-Z0-9@._-]', '_', email)[:64]
        return None

    def _get_cart_file(self, user_id):
        import re
        safe = re.sub(r'[^a-zA-Z0-9@._-]', '_', user_id)[:64]
        return CART_DATA_DIR / f"{safe}.json"

    def _handle_cart_api(self, method):
        """Handle /api/cart GET, POST, DELETE."""
        user_id = self._get_cart_user_id()
        if not user_id:
            self._send_json(401, {"error": "Not authenticated"})
            return

        cart_file = self._get_cart_file(user_id)
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        if method == "GET":
            if cart_file.exists():
                try:
                    with open(cart_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._send_json(200, data)
                except Exception as e:
                    logger.error("Cart read error for %s: %s", user_id, e)
                    self._send_json(200, {"cartItems": [], "userId": user_id})
            else:
                self._send_json(200, {"cartItems": [], "userId": user_id})
            return

        if method == "DELETE":
            item_id = query.get("item", [""])[0].strip()
            if item_id:
                # Remove single item
                if cart_file.exists():
                    try:
                        with open(cart_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        items = data.get("cartItems", [])
                        items = [i for i in items if str(i.get("id", "")) != item_id and str(i.get("cartItemId", "")) != item_id]
                        data["cartItems"] = items
                        with open(cart_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, ensure_ascii=False)
                        logger.info("Cart item %s removed for user %s", item_id, user_id)
                        self._send_json(200, {"success": True, "cartItems": items})
                    except Exception as e:
                        logger.error("Cart delete-item error: %s", e)
                        self._send_json(500, {"error": str(e)})
                else:
                    self._send_json(200, {"success": True, "cartItems": []})
            else:
                # Clear entire cart
                try:
                    if cart_file.exists():
                        cart_file.unlink()
                    logger.info("Cart cleared for user %s", user_id)
                    self._send_json(200, {"success": True, "cartItems": []})
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
            return

        if method in ("POST", "PUT", "PATCH"):
            body = self._read_body()
            try:
                payload = json.loads(body) if body and body != "{}" else {}
                cart_items = payload.get("cartItems", payload if isinstance(payload, list) else [])
                data = {
                    "userId": user_id,
                    "cartItems": cart_items,
                    "updatedAt": __import__('datetime').datetime.utcnow().isoformat() + "Z",
                }
                with open(cart_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                logger.info("Cart saved for user %s (%d items)", user_id, len(cart_items))
                self._send_json(200, {"success": True, "cartItems": cart_items, "userId": user_id})
            except Exception as e:
                logger.error("Cart save error for %s: %s", user_id, e)
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(405, {"error": "Method not allowed"})

    def _handle_sheet_sync(self, method):
        """
        Relay data to Google Sheets AND save locally to orders-data/.
        Endpoint: POST /api/sheet-sync
        Body: { type, userEmail, ... }
        """
        import urllib.request as ureq, urllib.error, threading

        if method not in ("POST", "PUT"):
            self._send_json(405, {"error": "Method not allowed"})
            return

        body = self._read_body()
        if not body or body == "{}":
            self._send_json(400, {"error": "Empty body"})
            return

        try:
            payload = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": "Invalid JSON: " + str(e)})
            return

        # Inject current user info from session if not already present
        user = self._get_current_user()
        if user:
            payload.setdefault("userEmail", user.get("email", ""))
            payload.setdefault("userName",  user.get("name",  ""))

        # ── 1. Save locally ───────────────────────────────────────────────────
        ORDERS_DATA_DIR = DIR / "orders-data"
        ORDERS_DATA_DIR.mkdir(exist_ok=True)

        record_type = payload.get("type", "order")
        fname = f"{record_type}_{__import__('datetime').datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}.json"
        try:
            with open(ORDERS_DATA_DIR / fname, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("Sheet-sync local save failed: %s", e)

        # ── 2. Forward to Google Apps Script in background thread ─────────────
        gas_url = payload.pop("gasUrl", None) or payload.pop("webAppUrl", None)
        # Also try config.json
        if not gas_url:
            cfg_file = DIR / "config.json"
            if cfg_file.exists():
                try:
                    cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
                    gas_url = cfg.get("googleSheetUrl", "") or cfg.get("webAppUrl", "")
                except Exception:
                    pass

        result = {"success": True, "local": fname}

        if gas_url:
            def forward():
                try:
                    data_bytes = json.dumps(payload).encode("utf-8")
                    req = ureq.Request(gas_url, data=data_bytes,
                                       headers={"Content-Type": "application/json"})
                    with ureq.urlopen(req, timeout=15) as resp:
                        resp_body = resp.read().decode("utf-8")
                        logger.info("Sheet-sync forwarded to GAS: %s", resp_body[:120])
                except Exception as e:
                    logger.warning("Sheet-sync GAS forward failed: %s", e)
            threading.Thread(target=forward, daemon=True).start()
            result["forwarded"] = gas_url[:60] + "..."

        self._send_json(200, result)

    def _handle_user_orders_api(self, method):
        """
        Permanent File-Based Order Storage (No Database Required).
        Stores orders per-user on disk: DIR/orders-data/users/<user_email>.json
        Survives browser cache clears, server restarts, and machine reboots.
        """
        user = self._get_current_user()
        if not user:
            self._send_json(401, {"error": "Not authenticated"})
            return

        email = user.get("email", "").strip().lower()
        import re
        safe_email = re.sub(r'[^a-zA-Z0-9@._-]', '_', email)[:64]

        USER_ORDERS_DIR = DIR / "orders-data" / "users"
        USER_ORDERS_DIR.mkdir(parents=True, exist_ok=True)
        user_orders_file = USER_ORDERS_DIR / f"{safe_email}.json"

        if method == "GET":
            orders = []
            if user_orders_file.exists():
                try:
                    with open(user_orders_file, "r", encoding="utf-8") as f:
                        orders = json.load(f)
                except Exception as e:
                    logger.warning("Error reading user orders file: %s", e)
            self._send_json(200, {"orders": orders, "userEmail": email, "count": len(orders)})
            return

        if method in ("POST", "PUT"):
            body = self._read_body()
            try:
                data = json.loads(body)
            except Exception as e:
                self._send_json(400, {"error": "Invalid JSON: " + str(e)})
                return

            orders = []
            if user_orders_file.exists():
                try:
                    with open(user_orders_file, "r", encoding="utf-8") as f:
                        orders = json.load(f)
                except Exception:
                    orders = []

            order_item = data.get("order") or data
            order_item["userEmail"] = email
            order_item["createdAt"] = __import__("datetime").datetime.utcnow().isoformat()

            oid = order_item.get("orderId") or order_item.get("id")
            if oid:
                orders = [o for o in orders if (o.get("orderId") or o.get("id")) != oid]

            orders.insert(0, order_item)

            try:
                with open(user_orders_file, "w", encoding="utf-8") as f:
                    json.dump(orders, f, ensure_ascii=False, indent=2)
                logger.info("Permanently saved order %s for user %s", oid, email)
                self._send_json(200, {"success": True, "orders": orders})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if method == "DELETE":
            parsed = urllib.parse.urlparse(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            oid = query.get("orderId", [""])[0] or query.get("id", [""])[0]

            orders = []
            if user_orders_file.exists():
                try:
                    with open(user_orders_file, "r", encoding="utf-8") as f:
                        orders = json.load(f)
                except Exception:
                    orders = []

            if oid:
                orders = [o for o in orders if (o.get("orderId") or o.get("id")) != oid]
            else:
                orders = []

            try:
                with open(user_orders_file, "w", encoding="utf-8") as f:
                    json.dump(orders, f, ensure_ascii=False, indent=2)
                self._send_json(200, {"success": True, "orders": orders})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(405, {"error": "Method not allowed"})

    def _handle_orders_data_get(self):
        """Return all locally-saved order records as JSON list."""
        user = self._get_current_user()
        ORDERS_DATA_DIR = DIR / "orders-data"
        ORDERS_DATA_DIR.mkdir(exist_ok=True)

        records = []
        try:
            import glob as _glob
            for fpath in sorted(ORDERS_DATA_DIR.glob("*.json")):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        rec = json.load(f)
                    # Filter by user email if not admin
                    if user and user.get("role") != "admin":
                        if rec.get("userEmail", "") != user.get("email", ""):
                            continue
                    rec["_file"] = fpath.name
                    records.append(rec)
                except Exception:
                    pass
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return

        self._send_json(200, records)

=======
        cookie_header = self.headers.get("Cookie", "")
        import http.cookies

        cookie = http.cookies.SimpleCookie()
        try:
            cookie.load(cookie_header)
        except Exception:
            pass
        if "session_token" in cookie:
            token = cookie["session_token"].value
            expected_token = "secure_smartiqo_session_token_xyz"
            return token == expected_token
        return False

>>>>>>> 16291ab (Initial project import)
    def do_GET(self):
        # Normalize relative/nested asset requests (e.g., /Dashboards/_next/ -> /_next/, /Dashboards/assets/ -> /assets/)
        for prefix in (
            "/_next/",
            "/assets/",
            "/icon/",
            "/Image/",
            "/image/",
            "/favicon.png",
            "/india.png",
        ):
            if prefix in self.path and not self.path.startswith(prefix):
                self.path = prefix + self.path.split(prefix, 1)[1]
                break

        path_lower = self.path.lower()
        is_assets = (
            self.path.startswith("/_next/")
            or self.path.startswith("/assets/")
            or self.path.startswith("/icon/")
            or self.path.startswith("/Image/")
            or self.path.startswith("/image/")
            or self.path.startswith("/favicon.png")
            or self.path.startswith("/india.png")
            or "custom-cart-sync.js" in path_lower
            or any(
                path_lower.endswith(ext)
                for ext in (
                    ".js",
                    ".css",
                    ".png",
                    ".jpg",
                    ".jpeg",
                    ".svg",
                    ".ico",
                    ".woff",
                    ".woff2",
                    ".ttf",
                )
            )
        )
        is_api = self.path.startswith("/api/")
        is_auth_api = "/api/auth/" in path_lower
        is_login_page = path_lower.startswith("/login")

        is_auth = self._is_authenticated()

        if not is_assets and not is_auth_api and not is_api:
<<<<<<< HEAD
            if is_login_page:
=======
            if self.path == '/admin':
                pass
            elif is_login_page:
>>>>>>> 16291ab (Initial project import)
                if is_auth:
                    self.send_response(302)
                    self.send_header("Location", "/")
                    self.send_header(
                        "Set-Cookie",
                        "session_token=secure_smartiqo_session_token_xyz; Path=/; HttpOnly; SameSite=Lax",
                    )
                    self.send_header("Set-Cookie", "logged_in=yes; Path=/; SameSite=Lax")
                    self.end_headers()
                    return
            else:
                if not is_auth:
                    self.send_response(302)
                    self.send_header("Location", "/Login")
                    self.end_headers()
                    return

        if self._serve_next_image():
            return
        if self.path.startswith("/api/"):
<<<<<<< HEAD
            parsed_path = urllib.parse.urlparse(self.path).path
            if parsed_path.rstrip("/") == "/api/cart" or parsed_path.startswith("/api/cart/"):
                self._handle_cart_api("GET")
                return
            if parsed_path.rstrip("/") in ("/api/user-orders", "/api/my-orders"):
                self._handle_user_orders_api("GET")
                return
            if parsed_path.rstrip("/") == "/api/orders-data":
                self._handle_orders_data_get()
                return
=======
>>>>>>> 16291ab (Initial project import)
            self._mock_api()
            return
        if self._serve_spa():
            return
        super().do_GET()

    def send_cors_headers(self, extra=None):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)

    def end_headers(self):
        self.send_cors_headers(
            {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )
        super().end_headers()

    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type=None):
        if not os.path.exists(path):
            return False
        if content_type is None:
            content_type = self.guess_type(str(path))
        with open(path, "rb") as f:
            data = f.read()

        if content_type and "text/html" in content_type:
            try:
                html_text = data.decode("utf-8", errors="ignore")
                if "<base " not in html_text:
                    if "<head>" in html_text:
                        html_text = html_text.replace("<head>", '<head><base href="/">', 1)
                    elif "<head " in html_text:
                        pos = html_text.find(">", html_text.find("<head "))
                        if pos != -1:
                            html_text = (
                                html_text[: pos + 1] + '<base href="/">' + html_text[pos + 1 :]
                            )
                data = html_text.encode("utf-8")
            except Exception:
                pass

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        return True

    def _serve_next_image(self):
        if not self.path.startswith("/_next/image"):
            return False
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        target_url = query.get("url", [""])[0]
        if not target_url:
            self._send_json(400, {"error": "Missing url parameter"})
            return True
        clean_path = urllib.parse.unquote(target_url).lstrip("/")
        local_file = DIR / clean_path
        if local_file.exists():
            self._send_file(str(local_file))
        else:
            logger.warning("Image not found: %s", clean_path)
            self.send_error(404, "Image not found")
        return True

    def _mock_api(self):
        parsed = urllib.parse.urlparse(self.path)
        api_path = parsed.path.strip("/")
        path_lower = self.path.lower()

        if "/api/auth/providers" in path_lower:
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

        if "/api/auth/csrf" in path_lower:
            self._send_json(200, {"csrfToken": "smartiqo_secure_csrf_token"})
            return

<<<<<<< HEAD
        if "/api/auth/session" in path_lower:
            user = self._get_current_user()
            if user:
                session_data = {
                    "user": {
                        "id": user.get("id", user["email"]),
                        "name": user.get("name", user["email"]),
                        "email": user["email"],
                        "role": user.get("role", "user"),
                        "isPremium": user.get("role") == "admin",
                        "parentUserId": None,
                    },
                    "expires": "2027-12-31T23:59:59.999Z",
=======

        if "/api/auth/session" in path_lower:
            is_auth = self._is_authenticated()
            if is_auth:
                import http.cookies
                cookie_header = self.headers.get("Cookie", "")
                cookie = http.cookies.SimpleCookie()
                try:
                    cookie.load(cookie_header)
                except:
                    pass
                auth_email = cookie.get("auth_email").value if "auth_email" in cookie else os.environ.get("AUTH_USERNAME", "info@smartiqo.com")
                auth_role = cookie.get("auth_role").value if "auth_role" in cookie else "user"
                
                session_data = {
                    "user": {
                        "id": "user1",
                        "name": "User",
                        "email": auth_email,
                        "role": auth_role,
                        "isPremium": False,
                        "parentUserId": None,
                    },
                    "expires": "2026-12-31T23:59:59.999Z",
>>>>>>> 16291ab (Initial project import)
                }
                self._send_json(200, session_data)
            else:
                self._send_json(200, {})
            return

<<<<<<< HEAD
=======

        if "/api/config/google-sheet-url" in path_lower:
            try:
                cfg_path = DIR / "config.json"
                if cfg_path.exists():
                    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
                    self._send_json(200, {"url": cfg.get("googleSheetUrl", "")})
                else:
                    self._send_json(200, {"url": ""})
            except Exception as e:
                self._send_json(200, {"url": ""})
            return

        if "/api/admin/users" in path_lower:
            try:
                users_path = DIR / "users.json"
                if users_path.exists():
                    users = json.loads(users_path.read_text(encoding="utf-8"))
                    # strip passwords
                    users_clean = [{"email": u.get("email"), "role": u.get("role"), "name": u.get("name")} for u in users]
                    self._send_json(200, {"users": users_clean})
                else:
                    self._send_json(200, {"users": []})
            except Exception as e:
                self._send_json(200, {"users": []})
            return

>>>>>>> 16291ab (Initial project import)
        if api_path == "api/icons":
            self._serve_dynamic_icons()
            return

        # 1. Try nested path in api/ dir (e.g. api/subscription/status.json)
        sub_path = api_path[len("api/") :]  # strip "api/" prefix
        nested_path = API_MOCK_DIR / (sub_path + ".json")
        if nested_path.exists():
            logger.info("API mock hit (nested): %s -> %s", self.path, nested_path)
            self._send_file(str(nested_path))
            return

        # 2. Try flat vdplshop.in_ naming convention
        filename = f"vdplshop.in_{api_path.replace('/', '_')}.json"
        candidates = [
            API_MOCK_DIR / filename,
            PAGES_DIR / filename,
        ]
        for file_path in candidates:
            if file_path.exists():
                logger.info("API mock hit: %s -> %s", self.path, file_path)
                self._send_file(str(file_path))
                return

        # 3. Try the direct filename in api/ dir (e.g. api/prices.json)
        last_segment = sub_path.split("/")[-1]
        direct_path = API_MOCK_DIR / (last_segment + ".json")
        if direct_path.exists():
            logger.info("API mock hit (direct): %s -> %s", self.path, direct_path)
            self._send_file(str(direct_path))
            return

        # 4. UserSettings wildcard match
        if "api/userSettings" in self.path:
            wildcard = list(PAGES_DIR.glob("vdplshop.in_api_userSettings_*.json"))
            if not wildcard:
                wildcard = list(API_MOCK_DIR.glob("vdplshop.in_api_userSettings_*.json"))
            if not wildcard:
                wildcard = list((API_MOCK_DIR / "userSettings").glob("*.json"))
            if wildcard:
                self._send_file(str(wildcard[0]))
                return

        # 5. Special rich mocks for specific endpoints
        path_lower = self.path.lower()
        if "/api/orders" in path_lower:
            self._send_json(200, {"orders": [], "total": 0, "page": 1, "limit": 10})
            return
        if "/api/logs" in path_lower:
            self._send_json(200, {"logs": [], "total": 0})
            return
        if "/api/auth/precheck" in path_lower:
            self._send_json(200, {"exists": False})
            return
        if "/api/register" in path_lower:
            self._send_json(200, {"success": True, "message": "Registration mock"})
            return
        if "/api/sendpanelemail" in path_lower or "/api/sendpanel" in path_lower:
            self._send_json(200, {"success": True, "message": "Email sent (mock)"})
            return
        if "/api/user/update-company-name" in path_lower:
            self._send_json(200, {"success": True})
            return

        logger.info("API mock fallback (empty): %s", self.path)
        self._send_json(200, {})

    def _serve_spa(self):
<<<<<<< HEAD
=======

        if self.path == '/admin':
            admin_path = DIR / 'admin.html'
            if admin_path.exists():
                self._send_file(str(admin_path), 'text/html')
                return True
            else:
                self.send_response(302)
                self.send_header("Location", "/")
                self.end_headers()
                return True

>>>>>>> 16291ab (Initial project import)
        translated = self.translate_path(self.path)
        if os.path.isfile(translated):
            return False
        if "." in self.path.split("/")[-1]:
            return False

        # Try to serve page-specific HTML from pages/ dir
        # Map route path -> pages/vdplshop.in_RouteSegments.html
        path_clean = self.path.split("?")[0].rstrip("/")
        if path_clean:
            # Convert /Dashboards/userDashboard -> vdplshop.in_Dashboards_userDashboard.html
            page_key = path_clean.lstrip("/").replace("/", "_")
            candidates = [
                PAGES_DIR / f"vdplshop.in_{page_key}.html",
                PAGES_DIR / f"vdplshop.in_{page_key.lower()}.html",
            ]
            for candidate in candidates:
                if candidate.exists():
                    logger.info("SPA page hit: %s -> %s", self.path, candidate)
                    self._send_file(str(candidate), "text/html")
                    return True

        index_path = DIR / "index.html"
        if index_path.exists():
            self._send_file(str(index_path), "text/html")
            return True
        return False

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        mime_map = {
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".ttf": "font/ttf",
            ".otf": "font/otf",
            ".eot": "application/vnd.ms-fontobject",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            ".pdf": "application/pdf",
        }
        return mime_map.get(ext) or super().guess_type(path)


def serve_forever():
    server = ThreadedHTTPServer((HOST, PORT), CORSHandler)

    def shutdown(signum, frame):
        logger.info("Received signal %s, shutting down...", signum)
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info("Serving cloned website at http://%s:%s", HOST, PORT)
    logger.info("Open http://localhost:%s", PORT)
    logger.info("Press Ctrl+C to stop")

    server.serve_forever()


if __name__ == "__main__":
    load_env()
    if len(sys.argv) > 1 and sys.argv[1] not in ("-h", "--help"):
        PORT = int(sys.argv[1])
    serve_forever()
