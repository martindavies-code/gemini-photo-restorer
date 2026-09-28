#!/usr/bin/env python3
"""
Atelier 8K - Local Studio Server
================================
Serves the Atelier 8K web application locally on 127.0.0.1 with automatic port
selection, security isolation, and local configuration synchronization.
"""

import os
import sys
import json
import socket
import webbrowser
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Tuple

DEFAULT_PORT = 8000
MAX_PORT_ATTEMPTS = 10
DIRECTORY = Path(__file__).parent.resolve()

# Load environment
try:
    from dotenv import load_dotenv
    load_dotenv(DIRECTORY / ".env")
except ImportError:
    pass


class StudioRequestHandler(SimpleHTTPRequestHandler):
    """Secure local request handler for Atelier 8K studio UI."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def do_GET(self):
        # Local configuration endpoint for API key pre-population
        if self.path == "/api/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            origin = self.headers.get("Origin", "")
            if origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:"):
                self.send_header("Access-Control-Allow-Origin", origin)
            else:
                self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1")
            self.end_headers()

            api_key = os.environ.get("GEMINI_API_KEY", "").strip()
            response_data = {
                "apiKey": api_key,
                "status": "configured" if api_key else "missing"
            }
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
            return

        if self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","app":"Atelier 8K"}')
            return

        try:
            return super().do_GET()
        except (ConnectionResetError, BrokenPipeError):
            pass

    def end_headers(self):
        # Security headers for local studio execution
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress noisy asset logs; only log API endpoints and errors
        if args and len(args) > 0 and isinstance(args[0], str) and ("/api/" in args[0] or "40" in str(args[1]) or "50" in str(args[1])):
            sys.stderr.write(f"[*] [Studio Server] {args[0]} - {args[1]}\n")


def find_available_server(host: str = "127.0.0.1", start_port: int = DEFAULT_PORT) -> Tuple[HTTPServer, int]:
    """Find and bind an available port starting at start_port."""
    for port in range(start_port, start_port + MAX_PORT_ATTEMPTS):
        try:
            HTTPServer.allow_reuse_address = True
            server = HTTPServer((host, port), StudioRequestHandler)
            return server, port
        except OSError:
            # Port already in use, increment
            continue
    raise RuntimeError(f"Could not bind to any port between {start_port} and {start_port + MAX_PORT_ATTEMPTS - 1}.")


def main():
    os.chdir(DIRECTORY)
    host = "127.0.0.1"

    try:
        httpd, port = find_available_server(host=host, start_port=DEFAULT_PORT)
    except Exception as e:
        print(f"[x] Fatal: Unable to start local server: {e}")
        sys.exit(1)

    url = f"http://{host}:{port}"
    print("=" * 65)
    print("    ATELIER 8K — FORENSIC PHOTO RESTORATION STUDIO")
    print(f"    Local Studio URL: {url}")
    print("=" * 65)
    print("[+] Launching web studio in your default browser...")
    webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Shutting down studio server...")
    finally:
        httpd.server_close()
        print("[*] Studio server closed cleanly.")


if __name__ == "__main__":
    main()
