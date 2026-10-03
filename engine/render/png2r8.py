# Convert atlas PNGs to raw R8 next to them (run on the render box after syncing PNGs).
import sys, numpy as np
from PIL import Image
for p in sys.argv[1:]:
    np.asarray(Image.open(p)).astype(np.uint8).tofile(p[:-4] + '.r8')
    print('r8', p)
