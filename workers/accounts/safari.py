"""Read only selected-platform Safari cookies; no network or diagnostic output."""
import contextlib
import io
import json
import os
import sys
import time


def selected_domain(domain, platform):
    hostname = domain.lstrip(".").lower()
    return hostname == platform + ".com" or hostname.endswith("." + platform + ".com")


def convert_cookies(jar, platform):
    cookies = []
    for cookie in jar:
        if not selected_domain(cookie.domain, platform) or not cookie.value:
            continue
        expires = -1 if cookie.expires is None else cookie.expires
        if expires != -1 and expires <= time.time():
            continue
        cookies.append({"name": cookie.name, "value": cookie.value, "domain": cookie.domain,
                        "path": cookie.path or "/", "expires": expires,
                        "httpOnly": cookie.has_nonstandard_attr("HTTPOnly"), "secure": cookie.secure,
                        # browser_cookie3 does not expose Safari's SameSite flags.
                        "sameSite": "Lax"})
    names = {"sessionid", "sessionid_ss"} if platform == "tiktok" else {"sessionid"}
    if not any(cookie["name"] in names for cookie in cookies):
        return {"ok": False, "reason": "cookies_missing"}
    if len(cookies) > 1000:
        return {"ok": False, "reason": "source_error"}
    return {"ok": True, "cookies": cookies}


def collect(platform):
    if sys.platform != "darwin":
        return {"ok": False, "reason": "unsupported"}
    if platform not in ("tiktok", "instagram"):
        return {"ok": False, "reason": "source_error"}
    try:
        import browser_cookie3
    except ImportError:
        return {"ok": False, "reason": "setup_required"}
    try:
        cookie_file = None
        for path in browser_cookie3.Safari.safari_cookies:
            candidate = os.path.expanduser(path)
            try:
                size = os.stat(candidate).st_size
            except FileNotFoundError:
                continue
            if size > 64_000_000:
                return {"ok": False, "reason": "source_error"}
            cookie_file = candidate
            break
        if cookie_file is None:
            return {"ok": False, "reason": "cookies_missing"}
        return convert_cookies(browser_cookie3.safari(cookie_file=cookie_file, domain_name=platform + ".com"), platform)
    except PermissionError:
        return {"ok": False, "reason": "permission_required"}
    except FileNotFoundError:
        return {"ok": False, "reason": "cookies_missing"}
    except Exception:
        return {"ok": False, "reason": "source_error"}


if __name__ == "__main__":
    # Only the final structured response enters the private Node pipe.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        result = collect(sys.argv[1] if len(sys.argv) == 2 else "")
    print(json.dumps(result))
