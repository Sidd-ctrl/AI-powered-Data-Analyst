import csv, io, json, uuid
import pandas as pd
import numpy as np
from fastapi import HTTPException
from app.core import MAX_BYTES, MAX_ROWS

def records(df, limit=500):
    return json.loads(df.head(limit).to_json(orient='records', date_format='iso'))

def ingest(content, name):
    if not name.lower().endswith('.csv'): raise HTTPException(400, 'Only CSV files are supported.')
    if len(content) > MAX_BYTES: raise HTTPException(413, 'File exceeds the configured upload limit.')
    try: text = content.decode('utf-8-sig')
    except UnicodeDecodeError: raise HTTPException(400, 'Use UTF-8 encoded CSV files. No data was imported.')
    if not text.strip(): raise HTTPException(400, 'The CSV is empty.')
    try:
        reader = csv.reader(io.StringIO(text), strict=True)
        header = next(reader)
        if not header or any(not c.strip() for c in header): raise ValueError('Missing column headers.')
        if len(set(header)) != len(header): raise ValueError('Duplicate column names. Rename them before uploading.')
        if len(header) > 100: raise ValueError('Maximum 100 columns.')
        if all(_numeric(c) for c in header): raise ValueError('Missing textual column headers.')
        for i, row in enumerate(reader):
            if len(row) != len(header): raise ValueError(f'Row {i+2} has {len(row)} fields; expected {len(header)}.')
            if i >= MAX_ROWS: raise ValueError('Row limit exceeded.')
        df = pd.read_csv(io.StringIO(text))
        if df.empty: raise ValueError('CSV has no data records.')
    except (ValueError, csv.Error, pd.errors.ParserError) as e: raise HTTPException(400, str(e))
    warnings = []
    for c in df.select_dtypes('object'):
        s = df[c].dropna().astype(str)
        if s.str.strip().ne(s).any(): warnings.append(f'{c}: surrounding whitespace retained.')
        numeric = pd.to_numeric(s.str.replace(r'[$,]', '', regex=True), errors='coerce')
        if len(s) and numeric.notna().all():
            df[c] = pd.to_numeric(df[c].astype(str).str.replace(r'[$,]', '', regex=True), errors='coerce')
            warnings.append(f'{c}: numeric formatting normalized in the analytical copy.')
        elif 'date' in c.lower():
            dates = pd.to_datetime(df[c], errors='coerce')
            invalid = int((df[c].notna() & dates.isna()).sum())
            if invalid: warnings.append(f'{c}: {invalid} invalid dates; original values retained, date analyses exclude these values.')
    return make_dataset(df, name, len(content), warnings)

def _numeric(s):
    try: float(s); return True
    except ValueError: return False

def make_dataset(df, name, size=0, warnings=None):
    return {'id': uuid.uuid4().hex, 'name': name, 'size': size, 'df': df, 'warnings': warnings or []}

def profile(d):
    df = d['df']; columns = []
    for c in df:
        s = df[c]; numeric = pd.api.types.is_numeric_dtype(s)
        item = {'name': c, 'dtype': str(s.dtype), 'nulls': int(s.isna().sum()), 'null_pct': round(float(s.isna().mean()*100),2), 'unique': int(s.nunique()), 'constant': bool(s.nunique() <= 1), 'high_cardinality': bool(not numeric and s.nunique() > .9*len(s))}
        if numeric:
            clean = s.replace([np.inf,-np.inf], np.nan).dropna()
            q1,q3 = clean.quantile([.25,.75]) if len(clean) else (0,0)
            item.update({'sum': float(clean.sum()), 'mean': float(clean.mean()) if len(clean) else None, 'min': float(clean.min()) if len(clean) else None, 'max': float(clean.max()) if len(clean) else None, 'outliers': int(((clean < q1-1.5*(q3-q1)) | (clean > q3+1.5*(q3-q1))).sum())})
        columns.append(item)
    return {'columns': columns, 'missing': int(df.isna().sum().sum()), 'duplicates': int(df.duplicated().sum()), 'warnings': d['warnings']}

def metadata(d):
    return {k:d[k] for k in ['id','name','size']} | {'rows':len(d['df']), 'columns':len(d['df'].columns), 'schema': {c:str(t) for c,t in d['df'].dtypes.items()}}
