"""Serve the local project page with byte ranges for reliable video seeking."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self.range_length = None
        requested = self.headers.get("Range", "")
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested.strip())
        path = self.translate_path(self.path)
        # Unsupported/multiple ranges and directory requests use the normal
        # complete response. The standard handler retains its cache behavior.
        if not match or not any(match.groups()) or os.path.isdir(path):
            return super().send_head()

        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        info = os.fstat(source.fileno())
        modified = self.date_time_string(info.st_mtime)
        if self.headers.get("If-Range") not in (None, modified):
            source.close()
            return super().send_head()

        first, last = match.groups()
        try:
            if first:
                start = int(first)
                end = min(int(last), info.st_size - 1) if last else info.st_size - 1
            else:
                start = max(0, info.st_size - int(last))
                end = info.st_size - 1
        except ValueError:
            source.close()
            return super().send_head()

        if start >= info.st_size or start > end:
            source.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{info.st_size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        self.range_length = end - start + 1
        source.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(self.range_length))
        self.send_header("Content-Range", f"bytes {start}-{end}/{info.st_size}")
        self.send_header("Last-Modified", modified)
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        try:
            if self.range_length is None:
                return super().copyfile(source, outputfile)
            remaining = self.range_length
            while remaining:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            # Browsers routinely cancel media requests when seeking or pausing.
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int, nargs="?", default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(Path(__file__).resolve().parent))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"FireNav preview: http://{args.bind}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
