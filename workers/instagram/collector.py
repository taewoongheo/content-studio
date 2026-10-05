"""Anonymous metadata only. JSON request on stdin, one JSON result on stdout."""
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
    if request["kind"] == "post":
        posts = [normalize(instaloader.Post.from_shortcode(loader.context, request["id"]))]
        return {"posts": posts, "hasMore": False}
    profile = instaloader.Profile.from_username(loader.context, request["id"])
    posts = [normalize(post) for post in itertools.islice(profile.get_posts(), request["limit"])]
    return {"posts": posts, "hasMore": len(posts) == request["limit"]}


def main():
    request = json.load(sys.stdin)
    try:
        with contextlib.redirect_stdout(sys.stderr):
            result = collect(request)
        response = {"ok": True, **result}
    except Exception as error:
        name, message = type(error).__name__, str(error).lower()
        # HTTP 401/403 or an empty response do not establish a CAPTCHA.
        reason = "login_required" if name == "LoginRequiredException" else \
                 "rate_limited" if "429" in message else \
                 "access_denied" if "401" in message or "403" in message else \
                 "not_found" if name in ("ProfileNotExistsException", "QueryReturnedNotFoundException") else \
                 "source_error"
        response = {"ok": False, "reason": reason, "errorType": name}
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
