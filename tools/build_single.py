# Bundle the game into one self-contained HTML file (CSS, JS and fonts inlined).
import base64, os, re
root = os.path.join(os.path.dirname(__file__), '..')
html = open(os.path.join(root, 'index.html'), encoding='utf8').read()
css = open(os.path.join(root, 'style.css'), encoding='utf8').read()
def font(m):
    data = base64.b64encode(open(os.path.join(root, m.group(1)), 'rb').read()).decode()
    return f'url(data:font/woff2;base64,{data})'
css = re.sub(r'url\((fonts/[^)]+)\)', font, css)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
def js(m):
    return '<script>\n' + open(os.path.join(root, m.group(1)), encoding='utf8').read() + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', js, html)
artifact = '--artifact' in os.sys.argv
if artifact:  # the artifact host adds its own document skeleton
    html = re.sub(r'<!doctype html>\s*<html lang="ja">\s*<head>\s*', '', html)
    html = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', '', html)
    html = html.replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '')
    html = html.replace('<title>ふわもりディフェンス - Puffwood Defense</title>', '<title>ふわもりディフェンス</title>')
out = os.path.join(root, 'dist', 'puffwood-artifact.html' if artifact else 'puffwood-defense.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf8').write(html)
print(out, len(html))
