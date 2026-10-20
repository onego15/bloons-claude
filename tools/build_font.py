# Subset M PLUS Rounded 1c (SIL OFL 1.1) down to the characters the game uses.
import glob, os
from fontTools import subset
from fontTools.ttLib import TTFont
root = os.path.join(os.path.dirname(__file__), '..')
text = ''
for f in glob.glob(os.path.join(root, 'js', '*.js')) + [os.path.join(root, 'index.html')]:
    text += open(f, encoding='utf8').read()
chars = set(text) | set(' 0123456789+-×/%!?.,:()ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
os.makedirs(os.path.join(root, 'fonts'), exist_ok=True)
for w in (500, 800):
    for part in ('latin', 'japanese'):
        src = os.path.join(os.path.dirname(__file__), 'fontsrc', f'm-plus-rounded-1c-{part}-{w}-normal.woff2')
        f = TTFont(src)
        cmap = f.getBestCmap()
        keep = [ord(c) for c in chars if ord(c) in cmap]
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']
        s = subset.Subsetter(opts); s.populate(unicodes=keep); s.subset(f)
        out = os.path.join(root, 'fonts', f'mplus-{part}-{w}.woff2')
        f.flavor = 'woff2'; f.save(out)
        print(out, len(keep), os.path.getsize(out))
