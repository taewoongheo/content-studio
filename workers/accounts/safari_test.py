import importlib.util
import os
import sys
import types
import unittest
from http.cookiejar import Cookie
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("safari", os.path.join(os.path.dirname(__file__), "safari.py"))
safari = importlib.util.module_from_spec(spec)
spec.loader.exec_module(safari)


def cookie(domain=".instagram.com", name="sessionid", expires=None):
    return Cookie(0, name, "synthetic-secret", None, False, domain, True, True, "/", True,
                  True, expires, False, None, None, {"HTTPOnly": ""})


class SafariTests(unittest.TestCase):
    def test_filter_expiry_and_attributes(self):
        result = safari.convert_cookies([cookie(), cookie(".instagram.com.evil.example"), cookie(expires=1)], "instagram")
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["cookies"]), 1)
        self.assertTrue(result["cookies"][0]["httpOnly"])
        self.assertEqual(result["cookies"][0]["expires"], -1)
        self.assertEqual(safari.convert_cookies([cookie(name="csrf")], "instagram")["reason"], "cookies_missing")

    def test_permission_and_missing_file_are_redacted_without_reading_user_cookies(self):
        library = types.SimpleNamespace(Safari=types.SimpleNamespace(safari_cookies=["/synthetic/Cookies.binarycookies"]))
        with patch.object(sys, "platform", "darwin"), patch.dict(sys.modules, {"browser_cookie3": library}):
            with patch.object(os, "stat", side_effect=PermissionError("synthetic-secret")):
                self.assertEqual(safari.collect("instagram"), {"ok": False, "reason": "permission_required"})
            with patch.object(os, "stat", side_effect=FileNotFoundError()):
                self.assertEqual(safari.collect("instagram"), {"ok": False, "reason": "cookies_missing"})


if __name__ == "__main__":
    unittest.main()
