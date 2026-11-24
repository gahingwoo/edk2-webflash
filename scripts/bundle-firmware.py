#!/usr/bin/env python3
"""Bundle the edk2-rk3576 UEFI images of three release channels into the site.

    python3 scripts/bundle-firmware.py SITE          download, check, write SITE/firmware.json
    python3 scripts/bundle-firmware.py --fingerprint print what the channels point at now

The channels are the ones Maskrom Studio offers (its src/shared/channel.ts):
  stable      the newest release that is not a pre-release;
  prerelease  the newest release, pre-releases included;
  ci          the rolling release tagged "ci", which edk2-rk3576's build
              workflow replaces on every successful build of main. It is never
              a candidate for the other two.
Newest is by version, not by date. Drafts never count.

GitHub release downloads carry no CORS headers, so the page cannot fetch them
from github.com. Every image is downloaded here, checked against the release's
SHA256SUMS.txt, and served from the site under a fixed name:
  stable      rock4d-spi-edk2.img, cm5io-emmc-edk2.img, tspi3m-emmc-edk2.img
              (the names the page has always used)
  prerelease  prerelease/<same names>, or the stable files when it is the
              same release
  ci          ci/<same names>
firmware.json records each image's version, size and SHA-256, which the page
shows and checks the download against before anything is written.

The stable channel must bundle completely or the script fails, as before. The
other two are left out of firmware.json with a warning when they cannot be
bundled, so a CI release being replaced at that moment does not stop a deploy.

Needs only the Python standard library. GH_TOKEN, if set, is sent to the API.
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request

REPO = 'gahingwoo/edk2-rk3576'
API = f'https://api.github.com/repos/{REPO}/releases?per_page=100'
CI_TAG = 'ci'
CHANNELS = ('stable', 'prerelease', 'ci')
# board id -> (asset name prefix, file name on the site)
BOARDS = {
    'rock4d': ('ROCK4D-spi-edk2-', 'rock4d-spi-edk2.img'),
    'cm5io': ('CM5IO-emmc-edk2-', 'cm5io-emmc-edk2.img'),
    'tspi3m': ('TaishanPi3M-emmc-edk2-', 'tspi3m-emmc-edk2.img'),
}
CHANNEL_DIR = {'stable': '', 'prerelease': 'prerelease/', 'ci': 'ci/'}
# The photo of the TaishanPi 3M's MaskROM pads: a release download is sent as
# an attachment, so a link to it saves a file. Served from the site it opens
# in the browser. Taken from the stable release.
MSK_PADS = ('TaishanPi3M-msk-pads.png', 'tspi3m-msk-pads.png')


# ── Channel choice, as in Maskrom Studio ─────────────────────────────────────
def _split(v):
    s = v[1:] if v.startswith('v') else v
    main, _, pre = s.partition('-')
    nums = [int(x) if x.isdigit() else 0 for x in main.split('.')]
    return nums, (pre.split('.') if '-' in s else None)


def compare_versions(a, b):
    """<0, 0 or >0 as version a is older than, the same as or newer than b."""
    (xn, xp), (yn, yp) = _split(a), _split(b)
    for i in range(max(len(xn), len(yn))):
        d = (xn[i] if i < len(xn) else 0) - (yn[i] if i < len(yn) else 0)
        if d:
            return d
    if xp is None or yp is None:
        return 0 if xp is yp else (1 if xp is None else -1)
    for i in range(max(len(xp), len(yp))):
        p = xp[i] if i < len(xp) else None
        q = yp[i] if i < len(yp) else None
        if p is None or q is None:
            return 0 if p == q else (-1 if p is None else 1)
        pn, qn = p.isdigit(), q.isdigit()
        if pn and qn:
            if int(p) != int(q):
                return int(p) - int(q)
        elif p != q:
            return -1 if pn else 1 if qn else (-1 if p < q else 1)
    return 0


def _version(r):
    t = r['tag_name']
    return t[1:] if t.startswith('v') else t


def _is_pre(r):
    return r.get('prerelease') is True or '-' in _version(r)


def pick_release(releases, channel):
    ok = [r for r in releases if isinstance(r, dict) and isinstance(r.get('tag_name'), str) and not r.get('draft')]
    if channel == 'ci':
        return next((r for r in ok if r['tag_name'] == CI_TAG), None)
    best = None
    for r in ok:
        if r['tag_name'] == CI_TAG or (channel == 'stable' and _is_pre(r)):
            continue
        if best is None or compare_versions(_version(r), _version(best)) > 0:
            best = r
    return best


def ci_commit(r):
    """The commit a CI release was built from: target_commitish when it is a
    commit id, else "CI build <sha>" in its name or "Built from <sha>" in its notes."""
    t = r.get('target_commitish') or ''
    if re.fullmatch(r'[0-9a-f]{40}', t):
        return t
    for field, pat in (('body', r'\bBuilt from ([0-9a-f]{7,40})\b'), ('name', r'\bCI build ([0-9a-f]{7,40})\b')):
        m = re.search(pat, r.get(field) or '', re.I)
        if m:
            return m.group(1).lower()
    return None


def parse_sums(text):
    sums = {}
    for line in text.splitlines():
        m = re.fullmatch(r'([0-9a-fA-F]{64}) [ *](.+)', line.strip())
        if m:
            sums[m.group(2)] = m.group(1).lower()
    return sums


def image_asset(release, prefix):
    """The single asset PREFIX<version>.img of a release, and its version, or (None, None)."""
    found = [a for a in release.get('assets', []) if a['name'].startswith(prefix) and a['name'].endswith('.img')]
    if len(found) != 1:
        return None, None
    return found[0], found[0]['name'][len(prefix):-len('.img')]


def fingerprint(releases):
    """What the channels point at: changes when a release is published or the
    ci release is replaced. Empty for a channel that has no release now."""
    parts = []
    for c in CHANNELS:
        r = pick_release(releases, c)
        parts.append(f"{c}={r['tag_name']}:{r['id']}" if r else f'{c}=')
    return ';'.join(parts)


# ── Network ──────────────────────────────────────────────────────────────────
def _request(url, accept='application/vnd.github+json'):
    headers = {'Accept': accept, 'User-Agent': 'edk2-webflash-bundler'}
    tok = os.environ.get('GH_TOKEN')
    if tok and url.startswith('https://api.github.com/'):
        headers['Authorization'] = f'Bearer {tok}'
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300)


def fetch_releases():
    with _request(API) as r:
        return json.load(r)


def download(asset, dest):
    """Download a release asset to dest; returns its SHA-256."""
    h = hashlib.sha256()
    with _request(asset['browser_download_url'], 'application/octet-stream') as r, open(dest, 'wb') as f:
        while chunk := r.read(1 << 20):
            h.update(chunk)
            f.write(chunk)
    return h.hexdigest()


# ── Bundling ─────────────────────────────────────────────────────────────────
class Refused(Exception):
    pass


def bundle_channel(channel, release, site, tmp, strict):
    sums_asset = next((a for a in release.get('assets', []) if a['name'] == 'SHA256SUMS.txt'), None)
    if not sums_asset:
        raise Refused(f"release {release['tag_name']} has no SHA256SUMS.txt")
    p = os.path.join(tmp, f'{channel}-SHA256SUMS.txt')
    download(sums_asset, p)
    with open(p, encoding='utf-8') as f:
        sums = parse_sums(f.read())
    images = {}
    for board, (prefix, site_name) in BOARDS.items():
        asset, version = image_asset(release, prefix)
        if not asset:
            if strict:
                raise Refused(f"release {release['tag_name']} has not exactly one {prefix}*.img")
            print(f"  {channel}: no {prefix}*.img in {release['tag_name']}, left out", file=sys.stderr)
            continue
        want = sums.get(asset['name'])
        if not want:
            raise Refused(f"{asset['name']} is not in SHA256SUMS.txt")
        dest = os.path.join(tmp, asset['name'])
        got = download(asset, dest)
        if got != want:
            raise Refused(f"{asset['name']}: SHA-256 {got}, SHA256SUMS.txt says {want}")
        rel = CHANNEL_DIR[channel] + site_name
        os.makedirs(os.path.dirname(os.path.join(site, rel)) or site, exist_ok=True)
        shutil.move(dest, os.path.join(site, rel))
        images[board] = {'version': version, 'file': rel, 'size': asset['size'], 'sha256': got}
        print(f'  {channel}: {asset["name"]} -> {rel} ({got[:12]})')
    if not images:
        raise Refused(f"release {release['tag_name']} has no image this page writes")
    if channel == 'stable':
        png = next((a for a in release.get('assets', []) if a['name'] == MSK_PADS[0]), None)
        if not png:
            raise Refused(f'release {release["tag_name"]} has no {MSK_PADS[0]}')
        download(png, os.path.join(site, MSK_PADS[1]))
    return images


def describe(channel, release, images):
    d = {
        'tag': release['tag_name'],
        'title': release.get('name') or release['tag_name'],
        'url': release.get('html_url') or f"https://github.com/{REPO}/releases/tag/{release['tag_name']}",
        'published': release.get('published_at') or release.get('created_at'),
        'prerelease': channel != 'stable',
        'images': images,
    }
    if channel == 'ci':
        d['commit'] = ci_commit(release)
    return d


def main(argv):
    releases = fetch_releases()
    if argv[1:] == ['--fingerprint']:
        print(fingerprint(releases))
        return 0
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    site = argv[1]
    out = {'channels': {}, 'fingerprint': fingerprint(releases),
           'bundled': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    with tempfile.TemporaryDirectory() as tmp:
        for c in CHANNELS:
            r = pick_release(releases, c)
            if not r:
                if c == 'stable':
                    print('no stable release', file=sys.stderr)
                    return 1
                print(f'{c}: no release, left out', file=sys.stderr)
                continue
            same = next((k for k, v in out['channels'].items() if v['tag'] == r['tag_name']), None)
            if same:
                # The same release as a channel already bundled: share its files.
                out['channels'][c] = {**out['channels'][same], 'prerelease': c != 'stable', 'same': same}
                print(f"{c}: {r['tag_name']}, the same as {same}")
                continue
            print(f"{c}: {r['tag_name']} ({r.get('name') or ''})")
            try:
                images = bundle_channel(c, r, site, tmp, strict=c == 'stable')
            except Refused as e:
                if c == 'stable':
                    print(f'stable: {e}', file=sys.stderr)
                    return 1
                print(f'{c}: {e}; left out', file=sys.stderr)
                continue
            out['channels'][c] = describe(c, r, images)
    st = out['channels']['stable']
    # The keys the page read before there were channels, for a page still cached.
    out['release'] = st['tag']
    out['images'] = {b: i['version'] for b, i in st['images'].items()}
    with open(os.path.join(site, 'firmware.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    print(json.dumps(out, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
