import struct, os

def get_png_dims(path):
    with open(path, 'rb') as f:
        f.read(8)   # PNG signature
        f.read(4)   # chunk length
        f.read(4)   # IHDR
        w = struct.unpack('>I', f.read(4))[0]
        h = struct.unpack('>I', f.read(4))[0]
    return w, h

def get_jpg_dims(path):
    with open(path, 'rb') as f:
        f.read(2)  # SOI
        while True:
            marker = f.read(2)
            if len(marker) < 2:
                raise ValueError("Unexpected end of file")
            if marker[1] in (0xC0, 0xC1, 0xC2):
                f.read(3)
                h = struct.unpack('>H', f.read(2))[0]
                w = struct.unpack('>H', f.read(2))[0]
                return w, h
            length = struct.unpack('>H', f.read(2))[0]
            f.read(length - 2)

folder = "New Poker Tables 1920"
files = sorted(f for f in os.listdir(folder) if not f.startswith('.') and f != '.DS_Store')
print(f"{'File':<22} {'W':>5} {'H':>5} {'Ratio':>7}")
print('-' * 42)
for name in files:
    ext = name.lower().rsplit('.', 1)[-1]
    path = os.path.join(folder, name)
    try:
        if ext == 'png':
            w, h = get_png_dims(path)
        else:
            w, h = get_jpg_dims(path)
        print(f"{name:<22} {w:>5} {h:>5} {w/h:>7.4f}")
    except Exception as e:
        print(f"{name:<22} ERROR: {e}")
