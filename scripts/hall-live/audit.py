"""Read-only audit of the isolated local D1; never invokes a second runtime."""
import pathlib
import sqlite3

folder = pathlib.Path('.wrangler/hall-state/v3/d1/miniflare-D1DatabaseObject')
databases = [p for p in folder.glob('*.sqlite') if p.name != 'metadata.sqlite']
assert len(databases) == 1, 'Expected exactly one isolated hall database'
with sqlite3.connect(f'file:{databases[0]}?mode=ro', uri=True) as db:
    revision = db.execute('SELECT revision FROM hall_meta WHERE id=1').fetchone()[0]
    count, first, last = db.execute('SELECT count(*),min(revision),max(revision) FROM hall_audit').fetchone()
    assert count == revision and (revision == 0 or (first, last) == (1, revision))
    assert db.execute('SELECT count(*) FROM hall_write_guard').fetchone()[0] == 0
    assert db.execute('SELECT count(*) FROM hall_outbox').fetchone()[0] == 0
    assert db.execute('SELECT count(*) FROM hall_occupancy WHERE occupied NOT BETWEEN 0 AND 100 OR typeof(occupied) != "integer"').fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM hall_sessions WHERE status NOT IN ('started','ended')").fetchone()[0] == 0
    print(f'D1 audit: {count} contiguous committed revisions; no partial guard or stranded outbox; all occupancy constraints valid.')

# Check database constraints independently of the route's validation.
with sqlite3.connect(':memory:') as db:
    db.executescript(pathlib.Path('migrations/0014_hall_live.sql').read_text())
    for value in (-1, 101, 1.5):
        try:
            db.execute('INSERT INTO hall_occupancy VALUES(?,?,?,?,?)', ('test', value, 1, 0, 'test'))
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError(f'Database accepted invalid occupancy {value}')
    print('Schema rejects invalid percentages even without API validation.')
