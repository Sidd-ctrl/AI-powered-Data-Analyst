import sqlite3, time
import pandas as pd
from fastapi import HTTPException

def execute_sql(df, sql):
    if len(sql)>12000: raise HTTPException(400,'Query too long.')
    connection = sqlite3.connect(':memory:')
    try:
        df.to_sql('data', connection, index=False)
        connection.execute('PRAGMA query_only=ON')
        allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
        connection.set_authorizer(lambda action, a,b,c,d: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)
        deadline = time.monotonic()+3
        connection.set_progress_handler(lambda: int(time.monotonic()>deadline), 1000)
        cur=connection.execute(sql)
        if cur.description is None: raise ValueError('Only read-only queries allowed.')
        return pd.DataFrame(cur.fetchmany(501), columns=[x[0] for x in cur.description])
    except (sqlite3.Error, ValueError) as e: raise HTTPException(400, f'SQL rejected: {e}')
    finally: connection.close()
