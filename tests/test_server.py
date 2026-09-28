#!/usr/bin/env python3
"""
Unit and Integration Tests for Atelier 8K - server.py
Tests server lifecycle, endpoint responses, security headers, and CORS isolation.
"""

import sys
import json
import urllib.request
import urllib.error
import threading
import time
import unittest
from pathlib import Path

# Ensure root directory is in sys.path
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(PROJECT_ROOT))

import server


class TestStudioServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd, cls.port = server.find_available_server(host="127.0.0.1", start_port=8900)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_health_endpoint(self):
        req = urllib.request.Request(f"{self.base_url}/api/health")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "ok")
            self.assertEqual(data.get("app"), "Atelier 8K")

    def test_security_headers_present(self):
        req = urllib.request.Request(f"{self.base_url}/api/health")
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.headers)
            self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
            self.assertEqual(headers.get("X-Frame-Options"), "DENY")

    def test_cors_local_origin_reflection(self):
        req = urllib.request.Request(f"{self.base_url}/api/config")
        req.add_header("Origin", f"http://localhost:{self.port}")
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.headers)
            self.assertEqual(headers.get("Access-Control-Allow-Origin"), f"http://localhost:{self.port}")

    def test_cors_rejects_external_origin(self):
        req = urllib.request.Request(f"{self.base_url}/api/config")
        req.add_header("Origin", "https://malicious-site.com")
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.headers)
            self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1")

    def test_static_file_serving(self):
        req = urllib.request.Request(f"{self.base_url}/index.html")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertIn("Atelier 8K", content)


if __name__ == "__main__":
    unittest.main()
