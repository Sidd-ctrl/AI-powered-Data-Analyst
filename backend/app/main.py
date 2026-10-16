import os, io, json, logging
from pathlib import Path
import pandas as pd
from fastapi import FastAPI, Request, Response, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Literal
from app.core import get_session, dataset, MAX_BYTES, MAX_ROWS
from app.services.data import ingest, metadata, profile, records, make_dataset
from app.services.analysis import query, anomalies, Plan, execute_plan
from app.security.sql import execute_sql
app=FastAPI(title='DataPilot AI',version='1.0.0')
def session(request:Request,response:Response): return get_session(request,response)
@app.exception_handler(Exception)
async def unexpected(request, exc):
    logging.error('Unhandled request failure: %s',type(exc).__name__)
    return JSONResponse(status_code=500,content={'detail':'The operation failed. Please check your inputs and try again.'})
class Selection(BaseModel):
    dataset_id: str
class Query(Selection):
    question: str=Field(min_length=1,max_length=2000)
class SQL(Selection):
    sql: str=Field(min_length=1,max_length=12000)
class Anomaly(Selection):
    columns: list[str] | None=None
    method: Literal['iqr','zscore','isolation_forest']='iqr'
class Merge(BaseModel):
    left: str
    right: str
    left_key: str
    right_key: str
    how: Literal['inner','left','right','outer']='inner'
class Chart(Selection):
    plan: Plan
class Export(BaseModel):
    analysis_id: str
    format: Literal['csv','markdown','sql','pandas']='csv'
@app.get('/api/health')
def health(): return {'status':'ok','ai_configured':bool(os.getenv('OPENROUTER_API_KEY')),'model':os.getenv('OPENROUTER_MODEL','openai/gpt-4o-mini'),'max_upload_mb':MAX_BYTES//1024//1024}
@app.get('/api/datasets')
def datasets(s=Depends(session)): return [metadata(d) for d in s.datasets.values()]
@app.post('/api/datasets/upload')
async def upload(files:list[UploadFile]=File(...),s=Depends(session)):
    if len(s.datasets)+len(files)>10: raise HTTPException(400,'Maximum 10 datasets per session.')
    staged=[]
    for f in files:
        content=await f.read(MAX_BYTES+1); staged.append(ingest(content,Path(f.filename or 'upload.csv').name))
    for d in staged: s.datasets[d['id']]=d
    return [metadata(d) for d in staged]
@app.post('/api/datasets/sample')
def sample(s=Depends(session)):
    if len(s.datasets)>=9: raise HTTPException(400,'Not enough dataset slots.')
    for name in ['synthetic_sales.csv','synthetic_customers.csv']:
        p=Path(__file__).resolve().parents[2]/'samples'/name
        if not p.exists(): p=Path(__file__).resolve().parents[3]/'samples'/name
        d=ingest(p.read_bytes(),name); s.datasets[d['id']]=d
    return [metadata(d) for d in s.datasets.values()]
@app.get('/api/datasets/{ident}')
def detail(ident:str,s=Depends(session)): return metadata(dataset(s,ident))
@app.delete('/api/datasets/{ident}')
def delete(ident:str,s=Depends(session)):
    dataset(s,ident); del s.datasets[ident]
    s.history[:]=[h for h in s.history if h['dataset_id']!=ident]
    s.dashboards[:]=[h for h in s.dashboards if h['dataset_id']!=ident]
    return {'ok':True}
@app.get('/api/datasets/{ident}/preview')
def preview(ident:str,s=Depends(session)): return records(dataset(s,ident)['df'],100)
@app.get('/api/datasets/{ident}/profile')
def profiling(ident:str,s=Depends(session)): return profile(dataset(s,ident))
@app.post('/api/analysis/query')
async def ask(body:Query,s=Depends(session)): return await query(dataset(s,body.dataset_id),body.question,s)
@app.post('/api/analysis/chart')
def chart(body:Chart,s=Depends(session)):
    result,sql,code=execute_plan(dataset(s,body.dataset_id)['df'],body.plan)
    return {'rows':records(result),'sql':sql,'pandas':code,'chart':body.plan.chart}
@app.post('/api/analysis/insights')
def insights(body:Selection,s=Depends(session)):
    d=dataset(s,body.dataset_id); p=profile(d)
    facts=[f'{len(d["df"]):,} records across {len(d["df"].columns)} columns.',f'{p["missing"]:,} missing cells and {p["duplicates"]:,} duplicate records.']
    for c in p['columns']:
        if 'mean' in c and c['mean'] is not None: facts.append(f'{c["name"]}: total {c["sum"]:,.2f}, average {c["mean"]:,.2f}; {c["outliers"]} IQR outliers.')
    return {'facts':facts,'recommendations':['Review missing values and duplicates before drawing business conclusions.','Investigate statistical outliers in context; unusual values are not necessarily errors.'],'profile':p}
@app.post('/api/analysis/anomalies')
def anomaly(body:Anomaly,s=Depends(session)): return anomalies(dataset(s,body.dataset_id)['df'],body.columns,body.method)
@app.post('/api/analysis/sql')
def sql(body:SQL,s=Depends(session)):
    result=execute_sql(dataset(s,body.dataset_id)['df'],body.sql)
    return {'rows':records(result,500),'truncated':len(result)>500,'sql':body.sql}
@app.post('/api/datasets/merge')
def merge(body:Merge,s=Depends(session)):
    if len(s.datasets)>=10: raise HTTPException(400,'Dataset limit reached.')
    l=dataset(s,body.left)['df']; r=dataset(s,body.right)['df']
    if body.left_key not in l or body.right_key not in r: raise HTTPException(422,'Join key not found.')
    if str(l[body.left_key].dtype)!=str(r[body.right_key].dtype): raise HTTPException(422,'Join key types differ. Normalize before merging.')
    a=l.groupby(body.left_key,dropna=False).size(); b=r.groupby(body.right_key,dropna=False).size()
    estimate=int(a.to_frame('a').join(b.rename('b'),how='outer').fillna(1).prod(axis=1).sum())
    if estimate>MAX_ROWS: raise HTTPException(413,'Join would exceed the row limit.')
    df=l.merge(r,left_on=body.left_key,right_on=body.right_key,how=body.how,suffixes=('_left','_right'))
    d=make_dataset(df,'Joined dataset.csv',warnings=['Pandas join semantics: null keys can match null keys. Overlapping columns are suffixed.'])
    s.datasets[d['id']]=d; return metadata(d)
@app.get('/api/sessions/current/history')
def history(s=Depends(session)): return s.history
@app.get('/api/dashboards')
def dashboards(s=Depends(session)): return s.dashboards
@app.post('/api/dashboards/{analysis_id}')
def save(analysis_id:str,s=Depends(session)):
    item=next((h for h in s.history if h['id']==analysis_id),None)
    if not item: raise HTTPException(404,'Analysis not found.')
    if not any(x['id']==analysis_id for x in s.dashboards): s.dashboards.append(item)
    return s.dashboards
@app.post('/api/reports/export')
def export(body:Export,s=Depends(session)):
    item=next((h for h in s.history+s.dashboards if h['id']==body.analysis_id),None)
    if not item: raise HTTPException(404,'Analysis not found.')
    if body.format=='csv':
        df=pd.DataFrame(item['rows'])
        for c in df.select_dtypes('object'): df[c]=df[c].map(lambda x: "'"+x if isinstance(x,str) and x.startswith(('=','+','-','@')) else x)
        content=df.to_csv(index=False)
    elif body.format=='markdown': content='# '+item['question']+'\n\n'+item['answer']+'\n\n```sql\n'+item['sql']+'\n```\n\n'+pd.DataFrame(item['rows']).to_csv(index=False)
    else: content=item[body.format]
    return Response(content,media_type='text/plain',headers={'Content-Disposition':f'attachment; filename="analysis.{"md" if body.format=="markdown" else "csv" if body.format=="csv" else "txt"}"'})
