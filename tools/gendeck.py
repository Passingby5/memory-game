# Builds a src/decks/*.js data file from pipe-separated source text in tools/content (one card per line):
# set|question|answer|wrong1|wrong2|why|sources (space separated)|[extra fields...]
# Source shorthand: B:x = britannica.com/x, A:x = archives.gov/milestone-documents/x, S:x = history.state.gov/milestones/x.
import json, sys, glob
PRE = {'B:': 'https://www.britannica.com/', 'A:': 'https://www.archives.gov/milestone-documents/', 'S:': 'https://history.state.gov/milestones/'}
def url(u):
    for k, v in PRE.items():
        if u.startswith(k): return v + u[len(k):]
    return u
def load(files):
    out = []
    for f in files:
        for ln, line in enumerate(open(f, encoding='utf8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'): continue
            p = line.split('|')
            assert len(p) >= 7, (f, ln, line)
            out.append(p[:6] + [[url(u) for u in p[6].split()]] + p[7:])
    return out
if __name__ == '__main__':
    deck, files = sys.argv[1], sys.argv[2:]
    rows = load(files)
    print(json.dumps(rows, ensure_ascii=False, indent=0))
