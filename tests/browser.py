#!/usr/bin/env python3
"""Run tests/flash.test.html in headless Chrome and print its result, or take
a screenshot of a page. Standard library only: it speaks the DevTools
protocol over a minimal WebSocket client.

    python3 tests/browser.py test URL                 exit 0 when every check passed
    python3 tests/browser.py shot URL OUT.png [JS]    run JS (optional) and save a PNG

CHROME names the browser (default: google-chrome, chromium). The page is
loaded with a 1280x900 window; WIDTH and HEIGHT change it.
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request


class WS:
    def __init__(self, url):
        host_port, path = url[len('ws://'):].split('/', 1)
        host, port = host_port.split(':')
        self.s = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        head = b''
        while b'\r\n\r\n' not in head:
            head += self.s.recv(1)
        if b' 101 ' not in head.split(b'\r\n')[0]:
            raise RuntimeError(head.decode(errors='replace'))
        self.id = 0

    def _recv(self, n):
        b = b''
        while len(b) < n:
            c = self.s.recv(n - len(b))
            if not c:
                raise EOFError
            b += c
        return b

    def send(self, obj):
        data = json.dumps(obj).encode()
        mask = os.urandom(4)
        n = len(data)
        hdr = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('>H', n) if n < 65536
                               else bytes([0x80 | 127]) + struct.pack('>Q', n))
        self.s.sendall(hdr + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(data)))

    def recv(self):
        msg = b''
        while True:
            b0, b1 = self._recv(2)
            n = b1 & 0x7f
            if n == 126:
                n = struct.unpack('>H', self._recv(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._recv(8))[0]
            msg += self._recv(n)
            if b0 & 0x80:
                return json.loads(msg)

    def call(self, method, **params):
        self.id += 1
        self.send({'id': self.id, 'method': method, 'params': params})
        while True:
            m = self.recv()
            if m.get('id') == self.id:
                if 'error' in m:
                    raise RuntimeError(f'{method}: {m["error"]}')
                return m.get('result', {})


def chrome():
    for c in [os.environ.get('CHROME'), 'google-chrome', 'chromium', 'chromium-browser']:
        if c and shutil.which(c):
            return c
    raise SystemExit('no Chrome found; set CHROME')


def open_page(url):
    port = 9300 + os.getpid() % 500
    prof = tempfile.mkdtemp(prefix='wf-chrome-', dir=os.environ.get('PROFILE_DIR'))
    w, h = os.environ.get('WIDTH', '1280'), os.environ.get('HEIGHT', '900')
    p = subprocess.Popen([chrome(), '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
                          f'--remote-debugging-port={port}', f'--user-data-dir={prof}', f'--window-size={w},{h}', 'about:blank'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list') as r:
                pages = [t for t in json.load(r) if t['type'] == 'page']
            if pages:
                break
        except OSError:
            pass
        time.sleep(0.2)
    else:
        p.kill()
        raise SystemExit('Chrome did not start')
    ws = WS(pages[0]['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Runtime.enable')
    ws.call('Page.navigate', url=url)
    return p, prof, ws


def evaluate(ws, js):
    r = ws.call('Runtime.evaluate', expression=js, awaitPromise=True, returnByValue=True)
    if 'exceptionDetails' in r:
        raise RuntimeError(json.dumps(r['exceptionDetails'])[:2000])
    return r['result'].get('value')


def main(argv):
    mode, url = argv[1], argv[2]
    p, prof, ws = open_page(url)
    try:
        if mode == 'test':
            deadline = time.time() + 120
            while time.time() < deadline:
                title = evaluate(ws, 'document.title')
                if title in ('passed', 'FAILED'):
                    break
                time.sleep(0.5)
            out = evaluate(ws, "document.getElementById('out') ? document.getElementById('out').textContent : ''")
            print(out)
            if title != 'passed':
                print(f'title: {title!r}', file=sys.stderr)
                return 1
            return 0
        if mode == 'shot':
            time.sleep(float(os.environ.get('WAIT', '3')))
            if len(argv) > 4:
                evaluate(ws, argv[4])
                time.sleep(1)
            full = os.environ.get('FULL') == '1'
            params = {'format': 'png'}
            if full:
                params['captureBeyondViewport'] = True
                m = ws.call('Page.getLayoutMetrics')['cssContentSize']
                params['clip'] = {'x': 0, 'y': 0, 'width': m['width'], 'height': m['height'], 'scale': 1}
            data = ws.call('Page.captureScreenshot', **params)['data']
            with open(argv[3], 'wb') as f:
                f.write(base64.b64decode(data))
            return 0
        raise SystemExit(__doc__)
    finally:
        try:
            ws.call('Browser.close')
        except Exception:
            p.kill()
        p.wait()
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main(sys.argv))
