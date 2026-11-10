#!/usr/bin/env python3
"""Stamp every page's CSS and JavaScript links with a new version number, so phones and browsers
fetch the newest files instead of showing saved old ones. Run it from the site folder before publishing:
    python3 tools/bump-version.py
"""
import glob, re, time, sys
version = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d%H%M')
pages = glob.glob('*.html')
pattern = re.compile(r'((?:href|src)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[0-9A-Za-z]+)?(")')
count = 0
for page in pages:
    text = open(page, encoding='utf-8').read()
    new = pattern.sub(lambda m: f'{m.group(1)}?v={version}{m.group(2)}', text)
    if new != text:
        open(page, 'w', encoding='utf-8').write(new)
        count += 1
print(f'Version {version} stamped on {count} pages.')
