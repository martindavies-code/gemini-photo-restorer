#!/usr/bin/env python3
"""
Lumina 8K - Local Web Server
Serves the web UI at http://localhost:8000 and exposes local config.
"""

import os
import sys
import json
import webbrowser
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from dotenv import load_dotenv

PORT = 8000
DIRECTORY = Path(__file__).parent.resolve()

# Load environment
load_dotenv(DIRECTORY / ".env")


class LuminaRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def do_GET(self):
        if self.path == "/api/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            api_key = os.environ.get("GEMINI_API_KEY", "")
            response_data = {"apiKey": api_key}
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
            return

        return super().do_GET()

    def log_message(self, format, *args):
        # Keep terminal output clean
        sys.stderr.write(f"[*] [Web Server] {args[0]} - {args[1]}\n")


def main():
    os.chdir(DIRECTORY)
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, LuminaRequestHandler)

    url = f"http://localhost:{PORT}"
    print("=" * 65)
    print("    LUMINA 8K — GEMINI PHOTO RESTORER WEB INTERFACE")
    print(f"    Serving at: {url}")
    print("=" * 65)
    print("[+] Opening web interface in your default browser...")
    webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Stopping web server.")
        httpd.server_close()


if __name__ == "__main__":
    main()
