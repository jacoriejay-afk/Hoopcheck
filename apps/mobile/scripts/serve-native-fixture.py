"""Serve an exported native-web fixture on localhost with SPA history fallback."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

directory = str(Path(sys.argv[1]).resolve(strict=True))
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8092

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self):
        if not Path(self.translate_path(self.path)).exists():
            self.path = "/index.html"
        super().do_GET()

ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
