import sqlite3, os

db_path = r'E:\linup-io\linup.db'
migrations_dir = r'E:\linup-io\src-tauri\migrations'

conn = sqlite3.connect(db_path)
c = conn.cursor()

files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
print(f'Found {len(files)} migration files')

for fname in files:
    path = os.path.join(migrations_dir, fname)
    sql = open(path, encoding='utf-8').read()
    try:
        c.executescript(sql)
        print(f'OK: {fname}')
    except Exception as e:
        print(f'SKIP {fname}: {e}')

conn.commit()

tables = c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
print('Tables:', [t[0] for t in tables])

try:
    cols = c.execute('PRAGMA table_info(projects)').fetchall()
    print('projects columns:', [col[1] for col in cols])
except Exception as e:
    print('projects error:', e)

conn.close()