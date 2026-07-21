import json
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# Resolve the root directory of the website clone
# fallback.py is at: website-clone/api/fallback.py
# Parent is: website-clone/api/
# Grandparent is: website-clone/
DIR = Path(__file__).parent.parent
API_MOCK_DIR = DIR / "api-static"
PAGES_DIR = DIR / "pages"


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type="application/json"):
        if not os.path.exists(path):
            self._send_json(404, {"error": f"File not found: {os.path.basename(path)}"})
            return
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        # E.g. /api/profile -> api_path is api/profile
        api_path = parsed.path.strip("/")
        path_lower = self.path.lower()

        # 1. Custom/Dynamic Icons merge
        if api_path == "api/icons":
            self._serve_dynamic_icons()
            return

        # 2. Match pricing constants / prices
        if "pricing-constants" in path_lower:
            pricing_json = API_MOCK_DIR / "pricing-constants.json"
            if not pricing_json.exists():
                pricing_json = API_MOCK_DIR / "vdplshop.in_api_pricing-constants.json"
            if pricing_json.exists():
                self._send_file(str(pricing_json))
                return

        # 3. Match subscription status
        if "subscription/status" in path_lower:
            sub_json = API_MOCK_DIR / "subscription" / "status.json"
            if not sub_json.exists():
                sub_json = API_MOCK_DIR / "subscription_status.json"
            if not sub_json.exists():
                sub_json = API_MOCK_DIR / "vdplshop.in_api_subscription_status.json"
            if sub_json.exists():
                self._send_file(str(sub_json))
                return

        # 4. UserSettings check
        if "api/usersettings" in path_lower:
            # Look in api-static/userSettings/
            settings_dir = API_MOCK_DIR / "userSettings"
            wildcard = list(settings_dir.glob("*.json"))
            if not wildcard:
                wildcard = list(API_MOCK_DIR.glob("vdplshop.in_api_userSettings_*.json"))
            if wildcard:
                self._send_file(str(wildcard[0]))
                return

            global_settings = API_MOCK_DIR / "vdplshop.in_api_userSettings___global__.json"
            if global_settings.exists():
                self._send_file(str(global_settings))
                return

        # 5. Try nested path in api/ dir (e.g. api/subscription/status.json -> api-static/subscription/status.json)
        sub_path = api_path[len("api/") :]  # strip "api/" prefix
        nested_path = API_MOCK_DIR / (sub_path + ".json")
        if nested_path.exists():
            self._send_file(str(nested_path))
            return

        # 6. Try flat vdplshop.in_ naming convention
        filename = f"vdplshop.in_{api_path.replace('/', '_')}.json"
        candidates = [
            API_MOCK_DIR / filename,
            PAGES_DIR / filename,
        ]
        for file_path in candidates:
            if file_path.exists():
                self._send_file(str(file_path))
                return

        # 7. Try the direct filename in api-static/ dir (e.g. api/prices -> api-static/prices.json)
        last_segment = sub_path.split("/")[-1]
        direct_path = API_MOCK_DIR / (last_segment + ".json")
        if direct_path.exists():
            self._send_file(str(direct_path))
            return

        # 8. Special rich mocks for specific endpoints
        if "/api/orders" in path_lower:
            self._send_json(
                200, {"orders": [], "total": 0, "page": 1, "limit": 10, "totalPages": 0}
            )
            return
        if "/api/logs" in path_lower:
            self._send_json(200, {"logs": [], "total": 0})
            return
        if "/api/auth/precheck" in path_lower:
            self._send_json(200, {"exists": False})
            return

        # Fallback empty json
        self._send_json(200, {})

    def do_POST(self):
        self._handle_write("POST")

    def do_PUT(self):
        self._handle_write("PUT")

    def do_PATCH(self):
        self._handle_write("PATCH")

    def do_DELETE(self):
        self._handle_write("DELETE")

    def _handle_write(self, method):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        path = self.path
        path_lower = path.lower()

        # Parse body JSON if possible
        try:
            body_data = json.loads(body)
        except Exception:
            body_data = {}

        if "coupons/validate" in path_lower:
            self._send_json(200, {"valid": True, "discount": 10, "message": "Coupon applied"})
            return

        if "logs/write" in path_lower:
            self._send_json(200, {"success": True})
            return

        if "prices/" in path_lower:
            self._send_json(200, {"success": True, **body_data})
            return

        if "admin/orders/" in path_lower:
            self._send_json(200, {"success": True, "status": "updated"})
            return

        if "usersettings/" in path_lower:
            self._send_json(200, {"success": True, **body_data})
            return

        if "sendpanelemail" in path_lower:
            self._send_json(200, {"success": True, "message": "Email sent"})
            return

        if "orders" in path_lower and method == "POST":
            # Generate a mock orderId
            import hashlib

            order_id = "ORD-" + hashlib.md5(body.encode("utf-8")).hexdigest()[:8].upper()
            self._send_json(200, {"success": True, "orderId": order_id, "message": "Order created"})
            return

        if "notifications" in path_lower and "/status" in path_lower:
            self._send_json(200, {"success": True})
            return

        if "offers" in path_lower and ("/impression" in path_lower or "/action" in path_lower):
            self._send_json(200, {"success": True})
            return

        if "update-company-name" in path_lower:
            company_name = body_data.get("companyName", "SmartIQO Technologies")
            self._send_json(200, {"success": True, "companyName": company_name})
            return

        if "activity/update" in path_lower or "/logs" in path_lower:
            self._send_json(200, {"success": True})
            return

        # Default success fallback
        self._send_json(200, {"success": True})

    def _serve_dynamic_icons(self):
        # 1. Load static icons.json
        static_path = API_MOCK_DIR / "icons.json"
        icons_data = []
        if static_path.exists():
            try:
                with open(static_path, encoding="utf-8") as f:
                    icons_data = json.load(f)
            except Exception:
                pass

        # 2. Read metadata of custom/uploaded icons
        metadata_path = DIR / "icon" / "dynamic" / "My_Icons" / "metadata.json"
        custom_icons = []
        if metadata_path.exists():
            try:
                with open(metadata_path, encoding="utf-8") as f:
                    metadata = json.load(f)

                # Check which files actually exist on disk
                for file_name, info in metadata.items():
                    file_path = DIR / "icon" / "dynamic" / "My_Icons" / file_name
                    if file_path.exists():
                        custom_icons.append(
                            {
                                "id": info.get("id"),
                                "categoryId": "custom-icons-category",
                                "categoryLabel": info.get("category", ""),
                                "name": info.get("name", "Custom Icon"),
                                "imageUrl": f"/icon/dynamic/My_Icons/{file_name}",
                            }
                        )
            except Exception:
                pass

        # 3. Group and merge custom icons
        if custom_icons:
            by_category = {}
            for icon in custom_icons:
                cat_label = icon["categoryLabel"]
                if cat_label not in by_category:
                    by_category[cat_label] = []
                by_category[cat_label].append(icon)

            for cat_label, icons in by_category.items():
                existing_cat = None
                for cat in icons_data:
                    if cat.get("categoryLabel") == cat_label:
                        existing_cat = cat
                        break

                if existing_cat:
                    existing_ids = {ic.get("id") for ic in existing_cat.get("icons", [])}
                    for ic in icons:
                        if ic["id"] not in existing_ids:
                            existing_cat.setdefault("icons", []).append(ic)
                else:
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
