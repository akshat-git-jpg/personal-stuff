import unittest
from web_validate import validate_payload, TEXT_MAX, EMO_MAX

class TestWebValidate(unittest.TestCase):
    def test_happy_path_defaults(self):
        ok, err, clean = validate_payload({"id": "s01", "text": " hello "})
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(clean, {"id": "s01", "text": "hello", "interval_silence": 200, "emo_text": None})

    def test_happy_path_all_fields(self):
        ok, err, clean = validate_payload({
            "id": "s99",
            "text": "world",
            "interval_silence": 250,
            "emo_text": "happy"
        })
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertEqual(clean, {"id": "s99", "text": "world", "interval_silence": 250, "emo_text": "happy"})

    def test_rejects_non_dict(self):
        ok, err, clean = validate_payload("not a dict")
        self.assertFalse(ok)
        self.assertEqual(err, "payload must be a JSON object")

    def test_bad_id(self):
        for bad_id in ["x01", "s1", "s001", 1, None]:
            with self.subTest(bad_id=bad_id):
                ok, err, clean = validate_payload({"id": bad_id, "text": "a"})
                self.assertFalse(ok)
                self.assertEqual(err, "id must match s\\d\\d (e.g. s07)")

    def test_empty_text(self):
        for bad_text in ["", "   ", None, 123]:
            with self.subTest(bad_text=bad_text):
                ok, err, clean = validate_payload({"id": "s01", "text": bad_text})
                self.assertFalse(ok)
                self.assertEqual(err, "text is required")

    def test_text_too_long(self):
        ok, err, clean = validate_payload({"id": "s01", "text": "a" * (TEXT_MAX + 1)})
        self.assertFalse(ok)
        self.assertEqual(err, f"text too long (max {TEXT_MAX} chars)")

    def test_bad_interval_silence(self):
        for bad_iv, expected_err in [
            (True, "interval_silence must be an integer"),
            (199.5, "interval_silence must be an integer"),
            ("200", "interval_silence must be an integer"),
            (49, "interval_silence out of range 50-500"),
            (501, "interval_silence out of range 50-500"),
        ]:
            with self.subTest(bad_iv=bad_iv):
                ok, err, clean = validate_payload({"id": "s01", "text": "a", "interval_silence": bad_iv})
                self.assertFalse(ok)
                self.assertEqual(err, expected_err)

    def test_bad_emo_text(self):
        for bad_emo, expected_err in [
            (123, "emo_text must be a string of at most 200 chars"),
            ("a" * (EMO_MAX + 1), "emo_text must be a string of at most 200 chars"),
        ]:
            with self.subTest(bad_emo=bad_emo):
                ok, err, clean = validate_payload({"id": "s01", "text": "a", "emo_text": bad_emo})
                self.assertFalse(ok)
                self.assertEqual(err, expected_err)

if __name__ == '__main__':
    unittest.main()
