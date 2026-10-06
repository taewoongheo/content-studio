import unittest
from collector import block_reason


class SessionFailureTests(unittest.TestCase):
    def test_local_guard_and_generic_401_do_not_reject_stored_cookies(self):
        self.assertEqual(block_reason("LoginRequiredException", "login required to access a private profile", True), "access_denied")
        self.assertEqual(block_reason("ConnectionException", "401 unauthorized", True), "access_denied")

    def test_explicit_platform_login_request_is_distinct_from_rate_limit(self):
        self.assertEqual(block_reason("ConnectionException", '{"message": "login_required"}', True), "login_required")
        self.assertEqual(block_reason("ConnectionException", "429 too many requests", True), "rate_limited")
        self.assertEqual(block_reason("LoginRequiredException", "login required", False), "login_required")


if __name__ == "__main__":
    unittest.main()
