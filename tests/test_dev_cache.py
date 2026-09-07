"""Exercise the development-only policy with an isolated, installed Apache 2.4."""
import pathlib
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]

class DevelopmentCacheTest(unittest.TestCase):
    def test_local_only_headers(self):
        apache = shutil.which('apache2')
        modules = pathlib.Path('/usr/lib/apache2/modules')
        if not apache or not modules.is_dir():
            self.skipTest('Apache 2.4 and Debian module paths required')
        with tempfile.TemporaryDirectory(prefix='linkuup-cache-') as directory:
            base = pathlib.Path(directory)
            web = base / 'public'
            web.mkdir()
            shutil.copyfile(ROOT / '.htaccess', web / '.htaccess')
            for name in ['asset.js', 'template.html', 'locale.json']:
                (web / name).write_text('test fixture')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            config = base / 'httpd.conf'
            config.write_text(f'''ServerRoot "{base}"
PidFile "{base}/httpd.pid"
Listen 127.0.0.1:{port}
ServerName localhost
LoadModule mpm_event_module {modules}/mod_mpm_event.so
LoadModule authz_core_module {modules}/mod_authz_core.so
LoadModule headers_module {modules}/mod_headers.so
ErrorLog "{base}/error.log"
DocumentRoot "{web}"
<Directory "{web}">
Require all granted
AllowOverride FileInfo
</Directory>
''')
            subprocess.run([apache, '-t', '-f', str(config)], check=True, capture_output=True)
            process = subprocess.Popen([apache, '-X', '-f', str(config)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                for attempt in range(100):
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=.1):
                            break
                    except OSError:
                        if process.poll() is not None:
                            self.fail(process.stderr.read().decode())
                        time.sleep(.02)
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                for host in ['localhost', '127.0.0.1', 'app.localhost', 'app.localhost:8080', 'app.www.linkuup.de', 'app.localhost.example.org']:
                    for name in ['asset.js', 'template.html', 'locale.json']:
                        req = urllib.request.Request(f'http://127.0.0.1:{port}/{name}', headers={'Host': host})
                        with opener.open(req, timeout=2) as response:
                            self.assertEqual(response.status, 200)
                            if host in ['app.www.linkuup.de', 'app.localhost.example.org']:
                                self.assertIsNone(response.headers.get('Cache-Control'))
                                self.assertIsNone(response.headers.get('Expires'))
                            else:
                                self.assertIn('no-store', response.headers['Cache-Control'])
                                self.assertEqual(response.headers['Expires'], '0')
            finally:
                process.terminate()
                process.communicate(timeout=5)

if __name__ == '__main__':
    unittest.main()
