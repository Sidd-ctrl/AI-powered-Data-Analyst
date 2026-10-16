import os, time, secrets
from dataclasses import dataclass, field
from fastapi import HTTPException
MAX_BYTES = int(os.getenv('MAX_UPLOAD_MB', '20')) * 1024 * 1024
MAX_ROWS = int(os.getenv('MAX_ROWS', '100000'))
SESSION_TTL = int(os.getenv('SESSION_TTL_SECONDS', '7200'))
@dataclass
class Session:
    datasets: dict = field(default_factory=dict)
    history: list = field(default_factory=list)
    dashboards: list = field(default_factory=list)
    context: dict = field(default_factory=dict)
    touched: float = field(default_factory=time.time)
sessions: dict[str, Session] = {}
def get_session(request, response):
    now = time.time()
    for key in list(sessions):
        if now - sessions[key].touched > SESSION_TTL: del sessions[key]
    sid = request.cookies.get('datapilot_session')
    if sid not in sessions:
        if len(sessions) >= 100: raise HTTPException(503, 'Session capacity reached. Try later.')
        sid = secrets.token_urlsafe(32)
        sessions[sid] = Session()
        response.set_cookie('datapilot_session', sid, httponly=True, samesite='strict', secure=os.getenv('COOKIE_SECURE','false') == 'true', max_age=SESSION_TTL)
    sessions[sid].touched = now
    return sessions[sid]
def dataset(session, ident):
    if ident not in session.datasets: raise HTTPException(404, 'Dataset not found in this session.')
    return session.datasets[ident]
