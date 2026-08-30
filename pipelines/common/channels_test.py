"""Run with a bare python3: python3 pipelines/common/channels_test.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import channels  # noqa: E402


class ChannelsTest(unittest.TestCase):
    def test_registry_path_resolves(self):
        self.assertTrue(os.path.isfile(channels.REGISTRY_PATH))

    def test_agrollo_is_present(self):
        c = channels.get_channel("agrollo")
        self.assertEqual(c["link_domain"], "go.agrolloo.com")
        self.assertEqual(c["youtube_channel_id"], "UCXuXNNuyhtdsiw9bZr0pUxw")

    def test_default_channel_resolves(self):
        self.assertEqual(channels.default_channel()["id"], "agrollo")

    def test_unknown_channel_raises(self):
        with self.assertRaises(KeyError):
            channels.get_channel("missing")

    def test_js_and_python_agree(self):
        """The two loaders must see the same channel ids, or the surfaces drift."""
        ids = sorted(c["id"] for c in channels.all_channels())
        self.assertEqual(ids, sorted(set(ids)))
        self.assertTrue(len(ids) >= 1)

    def test_profile_for_returns_the_block(self):
        p = channels.profile_for("agrollo")
        self.assertEqual(p["brand"], "default")
        self.assertTrue(p["voice_slug"])
        self.assertTrue(p["avatar_slug"])

    def test_profile_for_unknown_channel_raises(self):
        with self.assertRaises(KeyError):
            channels.profile_for("missing")


if __name__ == "__main__":
    unittest.main()
