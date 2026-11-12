#!/usr/bin/env python3
"""
Permanently remove expired announcements, so the site stays small and tidy.

  * Announcement slides (portal.html): removed the day after their date (data-expires), pop-up flyer included.
  * Event cards (portal-events.html): removed 365 days after their date (data-expires). Change CARD_KEEP_DAYS below.
  * Flyer pictures in images/announcements/ that no page uses any more: deleted (only files tracked by git).
  * Slides and cards with NO data-expires date are never touched.

It runs by itself every night (GitHub Action "Retire expired flyers"), or by hand:
    python3 tools/retire-expired.py --dry-run          # show what it would remove, change nothing
    python3 tools/retire-expired.py                    # do it
    python3 tools/retire-expired.py --today 2027-01-01 # pretend today is another date (for testing)

Safety: if an edit would leave a page with unbalanced tags, nothing is written. Every change is a normal git
commit, so it can be undone from GitHub's History (see the Handover Guide).
"""
import argparse
import datetime
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLIDE_FILE = "portal.html"
CARD_FILE = "portal-events.html"
CARD_KEEP_DAYS = 365              # event cards stay this many days after their date
IMAGE_DIR = "images/announcements"
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".webmanifest", ".svg", ".txt", ".yml"}


def central_today():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/Chicago")).date()
    except Exception:
        return datetime.datetime.utcnow().date() - datetime.timedelta(hours=6)


def attr(tag, name):
    m = re.search(r'\b' + re.escape(name) + r'="([^"]*)"', tag)
    return m.group(1) if m else None


def parse_date(s):
    try:
        return datetime.date.fromisoformat(s) if s else None
    except ValueError:
        return None


def div_block_end(text, start):
    """Index just after the </div> that closes the <div> starting at `start`."""
    depth = 0
    for m in re.finditer(r'<div\b|</div>', text[start:]):
        depth += 1 if m.group(0).startswith('<div') else -1
        if depth == 0:
            return start + m.end()
    raise ValueError("unbalanced <div> near offset %d" % start)


def article_block_end(text, start):
    end = text.find('</article>', start)
    if end == -1:
        raise ValueError("unclosed <article> near offset %d" % start)
    if '<article' in text[start + 8:end]:
        raise ValueError("nested <article> near offset %d (not supported)" % start)
    return end + len('</article>')


def whole_lines(text, start, end):
    """Widen [start, end) to whole lines when only whitespace shares them."""
    ls = text.rfind('\n', 0, start) + 1
    if text[ls:start].strip() == '':
        start = ls
    le = text.find('\n', end)
    if le != -1 and text[end:le].strip() == '':
        end = le + 1
    return start, end


def balance(text):
    return (text.count('<div') - text.count('</div>'), text.count('<article') - text.count('</article>'))


def label_of(block):
    m = re.search(r'<h3[^>]*>(.*?)</h3>', block, re.S)
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.group(1))).strip() if m else '(untitled)'


def retire(text, opener, ender, is_old, kind):
    """Remove every block opened by `opener` that is_old(data-expires). Returns (new_text, removed_blocks)."""
    removed = []
    spans = []
    for m in re.finditer(opener, text):
        tag = text[m.start():text.find('>', m.start()) + 1]
        exp = parse_date(attr(tag, 'data-expires'))
        if exp is None or not is_old(exp):
            continue
        end = ender(text, m.start())
        spans.append((m.start(), end, exp))
    for start, end, exp in reversed(spans):
        block = text[start:end]
        removed.append((kind, label_of(block), exp, block))
        s, e = whole_lines(text, start, end)
        text = text[:s] + text[e:]
    removed.reverse()
    return text, removed


def drop_orphan_modals(text, blocks):
    """Remove pop-up windows (modal-backdrop) that no button opens any more."""
    gone = []
    ids = set()
    for blk in blocks:
        ids.update(re.findall(r'data-modal-open="([^"]+)"', blk))
    for mid in sorted(ids):
        if f'data-modal-open="{mid}"' in text:
            continue                                  # still used by something else
        m = re.search(r'<div class="modal-backdrop"[^>]*\bid="' + re.escape(mid) + r'"', text)
        if not m:
            continue
        end = div_block_end(text, m.start())
        gone.append(text[m.start():end])
        s, e = whole_lines(text, m.start(), end)
        text = text[:s] + text[e:]
    return text, gone


def tracked(path_prefix):
    try:
        out = subprocess.run(["git", "ls-files", path_prefix], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        return [ln for ln in out.splitlines() if ln.strip()]
    except Exception:
        return []


def repo_text():
    chunks = []
    for p in ROOT.rglob('*'):
        if '.git' in p.parts or not p.is_file() or p.suffix.lower() not in TEXT_EXT:
            continue
        try:
            chunks.append(p.read_text(encoding='utf-8', errors='ignore'))
        except OSError:
            pass
    return "\n".join(chunks)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--today', help='pretend today is YYYY-MM-DD')
    a = ap.parse_args()
    today = parse_date(a.today) if a.today else central_today()
    if today is None:
        sys.exit('Bad --today date')
    card_cutoff = today - datetime.timedelta(days=CARD_KEEP_DAYS)
    print(f"Today (Central): {today}. Slides older than today go; cards dated before {card_cutoff} go.")

    writes = {}
    summary = []

    # 1. slides
    sp = ROOT / SLIDE_FILE
    stxt = sp.read_text(encoding='utf-8')
    before = balance(stxt)
    stxt, slides = retire(stxt, r'<article class="ann-slide"', article_block_end, lambda d: d < today, 'slide')
    stxt, modals1 = drop_orphan_modals(stxt, [b[3] for b in slides])
    if balance(stxt) != before:
        sys.exit(f"STOP: {SLIDE_FILE} would be left unbalanced; nothing written.")
    if slides:
        writes[sp] = stxt

    # 2. event cards
    cp = ROOT / CARD_FILE
    ctxt = cp.read_text(encoding='utf-8')
    before = balance(ctxt)
    ctxt, cards = retire(ctxt, r'<div class="reg-card"', div_block_end, lambda d: d < card_cutoff, 'event card')
    ctxt, modals2 = drop_orphan_modals(ctxt, [b[3] for b in cards])
    if balance(ctxt) != before:
        sys.exit(f"STOP: {CARD_FILE} would be left unbalanced; nothing written.")
    if cards:
        writes[cp] = ctxt

    for kind, name, exp, _ in slides + cards:
        summary.append(f"removed {kind}: {name} (date {exp})")
    if modals1 or modals2:
        summary.append(f"removed {len(modals1) + len(modals2)} unused pop-up window(s)")

    # 3. flyer pictures nothing uses any more (git-tracked files only)
    pending_text = {p: t for p, t in writes.items()}
    base = []
    for p in ROOT.rglob('*'):
        if '.git' in p.parts or not p.is_file() or p.suffix.lower() not in TEXT_EXT:
            continue
        base.append(pending_text.get(p) if p in pending_text else p.read_text(encoding='utf-8', errors='ignore'))
    haystack = "\n".join(t for t in base if t)
    pics = [pathlib.Path(f) for f in tracked(IMAGE_DIR)
            if pathlib.Path(f).suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'}]
    unused = [p for p in pics if p.name not in haystack]
    for p in unused:
        summary.append(f"deleted unused flyer picture: {p}")

    if not summary:
        print("Nothing to remove today.")
        return
    print("\n".join(summary))
    if a.dry_run:
        print("(dry run: nothing was changed)")
        return
    for p, t in writes.items():
        p.write_text(t, encoding='utf-8')
    for p in unused:
        (ROOT / p).unlink()
    print("Done.")


if __name__ == '__main__':
    main()
