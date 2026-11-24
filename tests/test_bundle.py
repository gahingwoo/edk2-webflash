"""Tests of the channel choice in scripts/bundle-firmware.py.
    python3 -m unittest discover -s tests
"""
import importlib.util
import os
import unittest

_path = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'bundle-firmware.py')
_spec = importlib.util.spec_from_file_location('bundle', _path)
bundle = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bundle)


def rel(tag, pre=False, draft=False, id=1, **kw):
    return {'tag_name': tag, 'prerelease': pre, 'draft': draft, 'id': id, **kw}


# The releases of edk2-rk3576 on 2026-11-24, newest first as the API lists them.
REAL = [
    rel('ci', pre=True, id=9, name='CI build cbbb844 2026-11-24',
        body='Built from cbbb844608582bc7f0bd0f6a89d94e62e6872735 on 2026-11-24 by the build workflow on main.',
        target_commitish='cbbb844608582bc7f0bd0f6a89d94e62e6872735'),
    rel('0.4.1', id=8), rel('0.4.0', id=7), rel('0.3.0', id=6),
    rel('0.3.0-tspi3m.1', pre=True, id=5), rel('0.2.1', id=4),
]


class Versions(unittest.TestCase):
    def test_order(self):
        c = bundle.compare_versions
        self.assertGreater(c('0.4.1', '0.4.0'), 0)
        self.assertGreater(c('0.10.0', '0.9.9'), 0)
        self.assertGreater(c('0.4.1', '0.4.1-rc1'), 0)
        self.assertLess(c('0.4.1-rc1', '0.4.1-rc2'), 0)
        self.assertLess(c('0.4.1-rc.2', '0.4.1-rc.10'), 0)
        self.assertGreater(c('0.4.2-rc1', '0.4.1'), 0)
        self.assertEqual(c('v0.4.1', '0.4.1'), 0)


class Channels(unittest.TestCase):
    def test_real_releases(self):
        self.assertEqual(bundle.pick_release(REAL, 'stable')['tag_name'], '0.4.1')
        # The only pre-release is older than 0.4.1, so the newest is 0.4.1.
        self.assertEqual(bundle.pick_release(REAL, 'prerelease')['tag_name'], '0.4.1')
        self.assertEqual(bundle.pick_release(REAL, 'ci')['tag_name'], 'ci')

    def test_newer_prerelease(self):
        rs = REAL + [rel('0.5.0-rc1', pre=True, id=10)]
        self.assertEqual(bundle.pick_release(rs, 'stable')['tag_name'], '0.4.1')
        self.assertEqual(bundle.pick_release(rs, 'prerelease')['tag_name'], '0.5.0-rc1')

    def test_dash_without_flag_is_prerelease(self):
        rs = [rel('0.4.1'), rel('0.5.0-rc1')]
        self.assertEqual(bundle.pick_release(rs, 'stable')['tag_name'], '0.4.1')

    def test_by_version_not_order(self):
        rs = [rel('0.2.1'), rel('0.4.1'), rel('0.3.0')]
        self.assertEqual(bundle.pick_release(rs, 'stable')['tag_name'], '0.4.1')

    def test_drafts_and_ci_never_count(self):
        rs = [rel('0.9.0', draft=True), rel('ci', pre=True), rel('0.4.1')]
        self.assertEqual(bundle.pick_release(rs, 'stable')['tag_name'], '0.4.1')
        self.assertEqual(bundle.pick_release(rs, 'prerelease')['tag_name'], '0.4.1')
        self.assertIsNone(bundle.pick_release([rel('0.4.1')], 'ci'))
        self.assertIsNone(bundle.pick_release([rel('ci', pre=True, draft=True)], 'ci'))

    def test_ci_commit(self):
        self.assertEqual(bundle.ci_commit(REAL[0]), 'cbbb844608582bc7f0bd0f6a89d94e62e6872735')
        self.assertEqual(bundle.ci_commit({'target_commitish': 'main', 'name': 'CI build 1a2b3c4 2026-11-24'}), '1a2b3c4')
        self.assertIsNone(bundle.ci_commit({'target_commitish': 'main', 'name': 'something'}))

    def test_fingerprint(self):
        self.assertEqual(bundle.fingerprint(REAL), 'stable=0.4.1:8;prerelease=0.4.1:8;ci=ci:9')
        self.assertEqual(bundle.fingerprint(REAL[1:]), 'stable=0.4.1:8;prerelease=0.4.1:8;ci=')


class Assets(unittest.TestCase):
    def test_sums(self):
        s = bundle.parse_sums('a' * 64 + '  CM5IO-emmc-edk2-ci-cbbb844.img\n' + 'B' * 64 + ' *x.img\nnot a line\n')
        self.assertEqual(s, {'CM5IO-emmc-edk2-ci-cbbb844.img': 'a' * 64, 'x.img': 'b' * 64})

    def test_image_asset(self):
        r = {'tag_name': 'ci', 'assets': [{'name': n} for n in (
            'CM5IO-emmc-edk2-ci-cbbb844.img', 'CM5IO-sdcard-edk2-ci-cbbb844.img', 'CM5IO-emmc.sfdisk',
            'TaishanPi3M-emmc-edk2-ci-cbbb844.img')]}
        a, v = bundle.image_asset(r, 'CM5IO-emmc-edk2-')
        self.assertEqual((a['name'], v), ('CM5IO-emmc-edk2-ci-cbbb844.img', 'ci-cbbb844'))
        self.assertEqual(bundle.image_asset(r, 'ROCK4D-spi-edk2-'), (None, None))
        two = {'assets': [{'name': 'ROCK4D-spi-edk2-1.img'}, {'name': 'ROCK4D-spi-edk2-2.img'}]}
        self.assertEqual(bundle.image_asset(two, 'ROCK4D-spi-edk2-'), (None, None))


if __name__ == '__main__':
    unittest.main()
