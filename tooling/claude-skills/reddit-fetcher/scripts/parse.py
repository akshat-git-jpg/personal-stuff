#!/usr/bin/env python3
"""Parse an old.reddit.com thread page (as saved by fetch.sh) into readable
post + comment text. Requires beautifulsoup4 (pip install bs4).

Usage: parse.py <html-file>   (or pipe HTML on stdin with no args)
"""
import sys
from bs4 import BeautifulSoup


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            html = f.read()
    else:
        html = sys.stdin.read()

    soup = BeautifulSoup(html, "html.parser")

    title = soup.find("a", class_="title")
    author = soup.select_one("div.thing.link p.tagline a.author")
    score = soup.select_one("div.thing.link div.score.unvoted")
    body = soup.select_one("div.thing.link div.usertext-body")

    print("TITLE:", title.get_text(strip=True) if title else "N/A")
    print("AUTHOR:", author.get_text(strip=True) if author else "N/A")
    print("SCORE:", score.get_text(strip=True) if score else "N/A")
    print("\n--- POST BODY ---")
    print(body.get_text("\n", strip=True) if body else "(no body / link post)")

    print("\n--- COMMENTS ---")
    comments = soup.select("div.comment")
    print(f"(comment nodes found: {len(comments)} — old.reddit.com paginates very")
    print(" long threads behind 'load more comments' / 'continue this thread',")
    print(" which this parser does not follow)")
    for c in comments:
        author_tag = c.select_one("a.author")
        author_name = author_tag.get_text(strip=True) if author_tag else "[deleted]"
        score_tag = c.select_one("span.score.unvoted")
        score_text = score_tag.get_text(strip=True) if score_tag else ""
        body_tag = c.select_one("div.usertext-body")
        body_text = body_tag.get_text("\n", strip=True) if body_tag else ""
        indent = "  " if c.find_parent("div", class_="comment") else ""
        print(f"\n{indent}[{author_name}] {score_text}")
        print(f"{indent}{body_text}")


if __name__ == "__main__":
    main()
