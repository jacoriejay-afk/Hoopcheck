"""Loopback-only navigation control for the unshipped native screenshot fixture."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(Path("/tmp/phase2-route.json").read_bytes())

    def do_POST(self):
        Path("/tmp/phase2-ready").touch()
        self.send_response(204)
        self.end_headers()


HTTPServer(("127.0.0.1", 8902), Handler).serve_forever()
