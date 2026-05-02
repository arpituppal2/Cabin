#!/usr/bin/env python3
import http.server, os, sys

PORT = int(os.environ.get('PORT', 5000))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
with http.server.HTTPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'CABIN serving on port {PORT}', flush=True)
    httpd.serve_forever()
