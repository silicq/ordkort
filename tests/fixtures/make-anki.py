# Makes the real .apkg files tests/apkg.test.mjs reads, with the official Anki engine:
#   pip install anki
#   python tests/fixtures/make-anki.py tests/fixtures
import os, sys, struct, zlib, shutil, tempfile
from anki.collection import Collection, ExportAnkiPackageOptions, DeckIdLimit

out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
tmp = tempfile.mkdtemp()
col = Collection(os.path.join(tmp, 'collection.anki2'))

def png(path, rgb):
    # a 2x2 PNG without any library
    w = h = 2
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

png(os.path.join(tmp, 'apple.png'), (200, 30, 30))
fname = col.media.add_file(os.path.join(tmp, 'apple.png'))

basic = col.models.by_name('Basic')
deck = col.decks.id('Norsk::Mat')
other = col.decks.id('Norsk')
rows = [
    ('et eple', f'apple<br><img src="{fname}">', deck),
    ('en banan', 'banana', deck),
    ('<b>å spise</b>', 'to eat &amp; dine', deck),
    ('et hus', 'house', other),
]
notes = []
for front, back, did in rows:
    n = col.new_note(basic)
    n['Front'] = front
    n['Back'] = back
    col.add_note(n, did)
    notes.append(n)

# a card that has been reviewed: interval 12 days, due in 5, ease 230%, 6 reps, 1 lapse
c = notes[0].cards()[0]
c.type = 2; c.queue = 2; c.ivl = 12; c.due = col.sched.today + 5; c.factor = 2300; c.reps = 6; c.lapses = 1
col.update_card(c)
# a suspended one
col.sched.suspend_cards([notes[1].cards()[0].id])

for legacy, name in [(False, 'anki-modern.apkg'), (True, 'anki-legacy.apkg')]:
    path = os.path.join(out_dir, name)
    col.export_anki_package(out_path=path, options=ExportAnkiPackageOptions(with_scheduling=True, with_deck_configs=False, with_media=True, legacy=legacy), limit=None)
    print(name, os.path.getsize(path), 'bytes')
col.close()
shutil.rmtree(tmp, ignore_errors=True)
