"""Metadata only; optional local authenticated web cookies. JSON request on stdin, one JSON result on stdout."""
import contextlib
import datetime
import itertools
import json
import sys
import instaloader


def nonnegative(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def normalize(post):
    # The pinned normalizer retains raw fields. Use them to preserve missing counts;
    # convenience properties can normalize an unavailable count into zero.
    post._obtain_metadata()
    node = post._node
    media = []
    nodes = list(post.get_sidecar_nodes()) if post.typename == "GraphSidecar" else []
    if nodes:
        for child in nodes:
            media.append({"type": "video" if child.is_video else "image",
                          "url": child.video_url if child.is_video else child.display_url,
                          "width": None, "height": None})
    else:
        media.append({"type": "video" if post.is_video else "image",
                      "url": post.video_url if post.is_video else post.url,
                      "width": None, "height": None})
    media = [item for item in media if item["url"]]
    return {
        "id": post.shortcode, "platform": "instagram",
        "url": "https://www.instagram.com/p/" + post.shortcode + "/",
        "author": post.owner_username, "text": post.caption or "",
        "format": ("slideshow" if all(x["type"] == "image" for x in media) else "mixed")
                  if nodes else ("video" if post.is_video else "image"),
        "publishedAt": post.date_utc.replace(tzinfo=datetime.timezone.utc).isoformat(),
        "publishedLabel": None,
        "collectedAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "metrics": {"likeCount": nonnegative(node.get("like_count")),
                    "viewCount": nonnegative(node.get("view_count")) if node.get("view_count") is not None
                                 else nonnegative(node.get("play_count")),
                    "saveCount": None, "commentCount": nonnegative(node.get("comment_count")),
                    "shareCount": None},
        "media": media,
    }


def collect(request):
    loader = instaloader.Instaloader(max_connection_attempts=1, request_timeout=12, quiet=True)
    for cookie in request.get("cookies", []):
        domain = cookie.get("domain", "").lstrip(".")
        if domain == "instagram.com" or domain.endswith(".instagram.com"):
            loader.context._session.cookies.set(cookie["name"], cookie["value"],
                                                domain=cookie["domain"], path=cookie.get("path", "/"))
    csrf = loader.context._session.cookies.get_dict().get("csrftoken")
    if csrf:
        loader.context._session.headers.update({"X-CSRFToken": csrf})
    if any(cookie.get("name") == "sessionid" for cookie in request.get("cookies", [])):
        # Resolve a real username through the library's supported session check.
        # A failed check is not proof of expiration; retain cookies for web access.
        username = loader.test_login()
        if username:
            loader.context.username = username
    if request["kind"] == "post":
        posts = [normalize(instaloader.Post.from_shortcode(loader.context, request["id"]))]
        has_more = False
    else:
        profile = instaloader.Profile.from_username(loader.context, request["id"])
        posts = [normalize(post) for post in itertools.islice(profile.get_posts(), request["limit"])]
        has_more = len(posts) == request["limit"]
    cookies = [{"name": cookie.name, "value": cookie.value, "domain": cookie.domain,
                "path": cookie.path or "/", "expires": cookie.expires if cookie.expires is not None else -1,
                "httpOnly": True, "secure": cookie.secure, "sameSite": "None"}
               for cookie in loader.context._session.cookies]
    return {"posts": posts, "hasMore": has_more, "cookies": cookies}



def block_reason(name, message, authenticated):
    # A local library guard can request login because username verification
    # failed. It does not prove that the browser's stored session expired.
    if "login_required" in message or (name == "LoginRequiredException" and not authenticated):
        return "login_required"
    if name == "LoginRequiredException" or "401" in message or "403" in message:
        return "access_denied"
    if "429" in message:
        return "rate_limited"
    if name in ("ProfileNotExistsException", "QueryReturnedNotFoundException"):
        return "not_found"
    return "source_error"


def main():
    request = json.load(sys.stdin)
    try:
        with contextlib.redirect_stdout(sys.stderr):
            result = collect(request)
        response = {"ok": True, **result}
    except Exception as error:
        name, message = type(error).__name__, str(error).lower()
        authenticated = any(cookie.get("name") == "sessionid" and cookie.get("value")
                            for cookie in request.get("cookies", []))
        reason = block_reason(name, message, authenticated)
        response = {"ok": False, "reason": reason, "errorType": name}
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
