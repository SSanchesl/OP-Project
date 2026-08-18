import sys, os
import http.server
import socketserver

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
directory = sys.argv[2] if len(sys.argv) > 2 else "."
os.chdir(directory)

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

handler = http.server.SimpleHTTPRequestHandler
with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
    print(f"Serving {directory} on 127.0.0.1:{port}")
    httpd.serve_forever()
