from PIL import Image
import os

# Resize poker table to 1920px wide for web
table = Image.open('/Users/davidconklin/Goodebags/GBG Files/TBK Poker Table HD trim.png')
w, h = table.size
new_h = int(h * 1920 / w)
table_resized = table.resize((1920, new_h), Image.LANCZOS).convert('RGB')
table_resized.save('/Users/davidconklin/Goodebags/public/games/tbk/assets/table.jpg', 'JPEG', quality=88, optimize=True)
print(f'Table saved: {table_resized.size}')

# Resize bee portrait avatars
os.makedirs('/Users/davidconklin/Goodebags/public/games/tbk/assets/avatars', exist_ok=True)
bees = [
    ('Portrait Neon with Bee 1.png',  'bee-1.png'),
    ('Portrait Neon with Bee 3.png',  'bee-3.png'),
    ('Portrait Neon with Bee 8.png',  'bee-8.png'),
    ('Portrait Neon with Bee 9.png',  'bee-9.png'),
    ('Portrait Neon with Bee 19.png', 'bee-19.png'),
]
for src, dst in bees:
    path = f'/Users/davidconklin/Goodebags/GBG Files/TBK/TBK Stuff for Online game/{src}'
    img = Image.open(path)
    aw = 180
    ah = int(img.height * aw / img.width)
    img.resize((aw, ah), Image.LANCZOS).save(
        f'/Users/davidconklin/Goodebags/public/games/tbk/assets/avatars/{dst}',
        'PNG', optimize=True
    )
    print(f'Avatar saved: {dst} {(aw, ah)}')

print('Done.')
