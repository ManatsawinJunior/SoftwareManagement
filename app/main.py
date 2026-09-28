from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import create_engine, String, Integer, ForeignKey, Text, Date, Table, Column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB = BASE / 'data' / 'projectflow.db'
DB.parent.mkdir(exist_ok=True)
engine = create_engine(f'sqlite:///{DB}', connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

project_developers = Table(
    'project_developers', Base.metadata,
    Column('project_id', ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True),
    Column('developer_id', ForeignKey('developers.id', ondelete='CASCADE'), primary_key=True),
    Column('role', String(50), default='Developer')
)

class Developer(Base):
    __tablename__='developers'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    name: Mapped[str]=mapped_column(String(150))
    email: Mapped[str]=mapped_column(String(200),default='')
    title: Mapped[str]=mapped_column(String(120),default='Developer')
    active: Mapped[bool]=mapped_column(default=True)
    projects=relationship('Project', secondary=project_developers, back_populates='developers')
class Project(Base):
    __tablename__='projects'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    code: Mapped[str]=mapped_column(String(50),unique=True)
    name: Mapped[str]=mapped_column(String(200))
    description: Mapped[str]=mapped_column(Text,default='')
    status: Mapped[str]=mapped_column(String(30),default='Active')
    features=relationship('Feature',cascade='all, delete-orphan')
    developers=relationship('Developer', secondary=project_developers, back_populates='projects')
class Feature(Base):
    __tablename__='features'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    project_id: Mapped[int]=mapped_column(ForeignKey('projects.id',ondelete='CASCADE'))
    code: Mapped[str]=mapped_column(String(50), unique=True)
    name: Mapped[str]=mapped_column(String(200))
    description: Mapped[str]=mapped_column(Text,default='')
    status: Mapped[str]=mapped_column(String(30),default='Backlog')
    functions=relationship('Function',cascade='all, delete-orphan')
class Function(Base):
    __tablename__='functions'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    feature_id: Mapped[int]=mapped_column(ForeignKey('features.id',ondelete='CASCADE'))
    code: Mapped[str]=mapped_column(String(50), unique=True)
    name: Mapped[str]=mapped_column(String(200))
    description: Mapped[str]=mapped_column(Text,default='')
    status: Mapped[str]=mapped_column(String(30),default='Backlog')
    pbis=relationship('PBI',cascade='all, delete-orphan')
class PBI(Base):
    __tablename__='pbis'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    function_id: Mapped[int]=mapped_column(ForeignKey('functions.id',ondelete='CASCADE'))
    code: Mapped[str]=mapped_column(String(50), unique=True)
    title: Mapped[str]=mapped_column(String(250))
    description: Mapped[str]=mapped_column(Text,default='')
    status: Mapped[str]=mapped_column(String(30),default='Backlog')
    priority: Mapped[str]=mapped_column(String(20),default='Medium')
    sprint_id: Mapped[int|None]=mapped_column(ForeignKey('sprints.id', ondelete='SET NULL'), nullable=True)


class Sprint(Base):
    __tablename__='sprints'
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    code: Mapped[str]=mapped_column(String(50),unique=True)
    name: Mapped[str]=mapped_column(String(200))
    period_type: Mapped[str]=mapped_column(String(20),default='Week')
    start_date: Mapped[str]=mapped_column(String(10))
    end_date: Mapped[str]=mapped_column(String(10))
    status: Mapped[str]=mapped_column(String(30),default='Planned')
    description: Mapped[str]=mapped_column(Text,default='')

Base.metadata.create_all(engine)
# Lightweight migration for existing V1 databases
from sqlalchemy import inspect
with engine.begin() as conn:
    cols=[x['name'] for x in inspect(engine).get_columns('pbis')]
    if 'sprint_id' not in cols:
        conn.exec_driver_sql("ALTER TABLE pbis ADD COLUMN sprint_id INTEGER")
    # Enforce globally unique IDs for hierarchy entities.
    # Existing duplicates will surface clearly during startup instead of being silently accepted.
    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ux_features_code ON features(code)")
    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ux_functions_code ON functions(code)")
    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ux_pbis_code ON pbis(code)")
    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ux_sprints_code ON sprints(code)")
app=FastAPI(title='ProjectFlow V1')
app.mount('/static',StaticFiles(directory=BASE/'app/static'),name='static')

class ProjectIn(BaseModel): code:str=''; name:str; description:str=''; status:str|None=None
class FeatureIn(BaseModel): project_id:int; code:str; name:str; description:str=''; status:str|None=None
class FunctionIn(BaseModel): feature_id:int; code:str; name:str; description:str=''; status:str|None=None
class PBIIn(BaseModel): function_id:int; code:str; title:str; description:str=''; status:str='Backlog'; priority:str='Medium'; sprint_id:int|None=None
class SprintIn(BaseModel): code:str; name:str; period_type:str='Week'; start_date:str; end_date:str; status:str='Planned'; description:str=''
class DeveloperIn(BaseModel): name:str; email:str=''; title:str='Developer'; active:bool=True
class ProjectMemberIn(BaseModel): developer_id:int; role:str='Developer'



def rollup_status(statuses, *, project=False):
    """Calculate parent status from child statuses.
    Priority: Blocked > In Progress > Review > To Do > Backlog > Done.
    A parent is Done/Completed only when every child is Done.
    """
    statuses = [x for x in statuses if x]
    if not statuses:
        return 'Active' if project else 'Backlog'
    if all(x == 'Done' for x in statuses):
        return 'Completed' if project else 'Done'
    if 'Blocked' in statuses:
        return 'Blocked'
    if 'In Progress' in statuses:
        return 'In Progress'
    if 'Review' in statuses:
        return 'Review'
    if 'To Do' in statuses:
        return 'To Do'
    return 'Backlog'


def refresh_rollup_statuses(s, project_ids=None):
    """Persist calculated statuses for Function -> Feature -> Project."""
    query = s.query(Project)
    if project_ids:
        query = query.filter(Project.id.in_(project_ids))
    for p in query.all():
        feature_statuses = []
        for f in p.features:
            function_statuses = []
            for fn in f.functions:
                fn.status = rollup_status([b.status for b in fn.pbis])
                function_statuses.append(fn.status)
            f.status = rollup_status(function_statuses)
            feature_statuses.append(f.status)
        p.status = rollup_status(feature_statuses, project=True)
    s.flush()


def next_code(s, model, prefix, width=3):
    """Generate the next globally unique code, e.g. F001 / FN001 / PBI-001 / SPR-001."""
    rows = s.query(model.code).all()
    max_no = 0
    for (code,) in rows:
        if not code:
            continue
        value = str(code).strip()
        if value.startswith(prefix):
            suffix = value[len(prefix):]
            if suffix.isdigit():
                max_no = max(max_no, int(suffix))
    return f"{prefix}{max_no + 1:0{width}d}"


def ensure_unique_code(s, model, code, current_id=None, label='ID'):
    q = s.query(model).filter(model.code == code)
    if current_id is not None:
        q = q.filter(model.id != current_id)
    if q.first():
        raise HTTPException(400, f'{label} already exists: {code}')


def all_data(s):
    refresh_rollup_statuses(s)
    s.commit()
    projects=[]
    for p in s.query(Project).all():
        features=[]
        for f in p.features:
            functions=[]
            for fn in f.functions:
                functions.append({'id':fn.id,'code':fn.code,'name':fn.name,'description':fn.description,'status':fn.status,'pbis':[{'id':x.id,'code':x.code,'title':x.title,'description':x.description,'status':x.status,'priority':x.priority,'sprint_id':x.sprint_id} for x in fn.pbis]})
            features.append({'id':f.id,'code':f.code,'name':f.name,'description':f.description,'status':f.status,'functions':functions})
        projects.append({'id':p.id,'code':p.code,'name':p.name,'description':p.description,'status':p.status,'features':features,'members':[{'id':d.id,'name':d.name,'email':d.email,'title':d.title,'active':d.active,'role':next((m.role for m in s.execute(project_developers.select().where((project_developers.c.project_id==p.id)&(project_developers.c.developer_id==d.id))).all()),'Developer')} for d in p.developers]})
    return projects
@app.get('/api/sprints')
def get_sprints():
    with SessionLocal() as s:
        return [dict(id=x.id,code=x.code,name=x.name,period_type=x.period_type,start_date=x.start_date,end_date=x.end_date,status=x.status,description=x.description) for x in s.query(Sprint).order_by(Sprint.start_date.desc()).all()]
@app.post('/api/sprints')
def add_sprint(x:SprintIn):
    with SessionLocal() as s:
        if s.query(Sprint).filter_by(code=x.code).first(): raise HTTPException(400,'Sprint code already exists')
        payload=x.model_dump(); payload['code']=next_code(s,Sprint,'SPR-'); o=Sprint(**payload); s.add(o); s.commit(); return {'ok':True,'id':o.id,'code':o.code}
@app.put('/api/sprints/{id}')
def edit_sprint(id:int,x:SprintIn):
    with SessionLocal() as s:
        o=s.get(Sprint,id)
        if not o: raise HTTPException(404)
        # Sprint ID is immutable and system-generated. Update metadata only.
        for k,v in x.model_dump(exclude={'code'}).items(): setattr(o,k,v)
        s.commit(); return {'ok':True}
@app.delete('/api/sprints/{id}')
def del_sprint(id:int):
    with SessionLocal() as s:
        o=s.get(Sprint,id)
        if not o: raise HTTPException(404)
        s.delete(o); s.commit(); return {'ok':True}

@app.get('/api/developers')
def get_developers():
    with SessionLocal() as s:
        return [{'id':d.id,'name':d.name,'email':d.email,'title':d.title,'active':d.active,
                 'projects':[{'id':p.id,'code':p.code,'name':p.name,
                              'role':next((r.role for r in s.execute(project_developers.select().where((project_developers.c.project_id==p.id)&(project_developers.c.developer_id==d.id))).all()),'Developer')} for p in d.projects]}
                for d in s.query(Developer).order_by(Developer.name).all()]

@app.post('/api/developers')
def add_developer(x:DeveloperIn):
    with SessionLocal() as s:
        d=Developer(**x.model_dump()); s.add(d); s.commit(); return {'ok':True,'id':d.id}

@app.put('/api/developers/{id}')
def edit_developer(id:int,x:DeveloperIn):
    with SessionLocal() as s:
        d=s.get(Developer,id)
        if not d: raise HTTPException(404,'Developer not found')
        for k,v in x.model_dump().items(): setattr(d,k,v)
        s.commit(); return {'ok':True}

@app.delete('/api/developers/{id}')
def delete_developer(id:int):
    with SessionLocal() as s:
        d=s.get(Developer,id)
        if not d: raise HTTPException(404,'Developer not found')
        s.delete(d); s.commit(); return {'ok':True}

@app.get('/api/projects/{project_id}/members')
def get_project_members(project_id:int):
    with SessionLocal() as s:
        p=s.get(Project,project_id)
        if not p: raise HTTPException(404,'Project not found')
        rows=s.execute(project_developers.select().where(project_developers.c.project_id==project_id)).all()
        return [{'id':d.id,'name':d.name,'email':d.email,'title':d.title,'active':d.active,'role':next((r.role for r in rows if r.developer_id==d.id),'Developer')} for d in p.developers]

@app.post('/api/projects/{project_id}/members')
def add_project_member(project_id:int,x:ProjectMemberIn):
    with SessionLocal() as s:
        p=s.get(Project,project_id); d=s.get(Developer,x.developer_id)
        if not p: raise HTTPException(404,'Project not found')
        if not d: raise HTTPException(404,'Developer not found')
        exists=s.execute(project_developers.select().where((project_developers.c.project_id==project_id)&(project_developers.c.developer_id==x.developer_id))).first()
        if exists: raise HTTPException(400,'Developer is already assigned to this project')
        s.execute(project_developers.insert().values(project_id=project_id,developer_id=x.developer_id,role=x.role))
        s.commit(); return {'ok':True}

@app.put('/api/projects/{project_id}/members/{developer_id}')
def edit_project_member(project_id:int,developer_id:int,x:ProjectMemberIn):
    with SessionLocal() as s:
        result=s.execute(project_developers.update().where((project_developers.c.project_id==project_id)&(project_developers.c.developer_id==developer_id)).values(role=x.role))
        if result.rowcount==0: raise HTTPException(404,'Project member not found')
        s.commit(); return {'ok':True}

@app.delete('/api/projects/{project_id}/members/{developer_id}')
def delete_project_member(project_id:int,developer_id:int):
    with SessionLocal() as s:
        result=s.execute(project_developers.delete().where((project_developers.c.project_id==project_id)&(project_developers.c.developer_id==developer_id)))
        if result.rowcount==0: raise HTTPException(404,'Project member not found')
        s.commit(); return {'ok':True}

@app.get('/')
def home(): return FileResponse(BASE/'app/static/index.html')
@app.get('/api/projects')
def get_projects():
    with SessionLocal() as s: return all_data(s)
@app.post('/api/projects')
def add_project(x:ProjectIn):
    with SessionLocal() as s:
        if s.query(Project).filter_by(code=x.code).first(): raise HTTPException(400,'Project code already exists')
        p=Project(code=x.code,name=x.name,description=x.description,status=x.status or 'Active')
        s.add(p); s.commit(); return {'ok':True}
@app.put('/api/projects/{id}')
def edit_project(id:int,x:ProjectIn):
    with SessionLocal() as s:
        p=s.get(Project,id)
        if not p: raise HTTPException(404)
        p.code=x.code; p.name=x.name; p.description=x.description
        refresh_rollup_statuses(s,[p.id]); s.commit(); return {'ok':True}
@app.delete('/api/projects/{id}')
def del_project(id:int):
    with SessionLocal() as s:
        p=s.get(Project,id)
        if not p: raise HTTPException(404)
        s.delete(p); s.commit(); return {'ok':True}

@app.post('/api/features')
def add_feature(x:FeatureIn):
    with SessionLocal() as s:
        if not s.get(Project,x.project_id): raise HTTPException(404,'Project not found')
        o=Feature(project_id=x.project_id,code=next_code(s,Feature,'F'),name=x.name,description=x.description,status='Backlog')
        s.add(o); s.commit(); refresh_rollup_statuses(s,[o.project_id]); s.commit(); return {'ok':True}
@app.put('/api/features/{id}')
def edit_feature(id:int,x:FeatureIn):
    with SessionLocal() as s:
        o=s.get(Feature,id)
        if not o: raise HTTPException(404)
        old_project=o.project_id
        if not s.get(Project,x.project_id): raise HTTPException(404,'Project not found')
        o.project_id=x.project_id; o.name=x.name; o.description=x.description
        refresh_rollup_statuses(s,{old_project,x.project_id}); s.commit(); return {'ok':True}
@app.delete('/api/features/{id}')
def del_feature(id:int):
    with SessionLocal() as s:
        o=s.get(Feature,id)
        if not o: raise HTTPException(404)
        project_id=o.project_id
        s.delete(o); s.flush(); refresh_rollup_statuses(s,[project_id]); s.commit(); return {'ok':True}

@app.post('/api/functions')
def add_function(x:FunctionIn):
    with SessionLocal() as s:
        feature=s.get(Feature,x.feature_id)
        if not feature: raise HTTPException(404,'Feature not found')
        o=Function(feature_id=x.feature_id,code=next_code(s,Function,'FN'),name=x.name,description=x.description,status='Backlog')
        s.add(o); s.commit(); refresh_rollup_statuses(s,[feature.project_id]); s.commit(); return {'ok':True}
@app.put('/api/functions/{id}')
def edit_function(id:int,x:FunctionIn):
    with SessionLocal() as s:
        o=s.get(Function,id)
        if not o: raise HTTPException(404)
        old_feature=s.get(Feature,o.feature_id)
        new_feature=s.get(Feature,x.feature_id)
        if not new_feature: raise HTTPException(404,'Feature not found')
        old_project=old_feature.project_id
        o.feature_id=x.feature_id; o.name=x.name; o.description=x.description
        refresh_rollup_statuses(s,{old_project,new_feature.project_id}); s.commit(); return {'ok':True}
@app.delete('/api/functions/{id}')
def del_function(id:int):
    with SessionLocal() as s:
        o=s.get(Function,id)
        if not o: raise HTTPException(404)
        project_id=s.get(Feature,o.feature_id).project_id
        s.delete(o); s.flush(); refresh_rollup_statuses(s,[project_id]); s.commit(); return {'ok':True}

@app.post('/api/pbis')
def add_pbi(x:PBIIn):
    with SessionLocal() as s:
        fn=s.get(Function,x.function_id)
        if not fn: raise HTTPException(404,'Function not found')
        payload=x.model_dump(); payload['code']=next_code(s,PBI,'PBI-'); o=PBI(**payload); s.add(o); s.commit()
        project_id=s.get(Feature,fn.feature_id).project_id
        refresh_rollup_statuses(s,[project_id]); s.commit(); return {'ok':True}
@app.put('/api/pbis/{id}')
def edit_pbi(id:int,x:PBIIn):
    with SessionLocal() as s:
        o=s.get(PBI,id)
        if not o: raise HTTPException(404)
        old_fn=s.get(Function,o.function_id)
        new_fn=s.get(Function,x.function_id)
        if not new_fn: raise HTTPException(404,'Function not found')
        old_project=s.get(Feature,old_fn.feature_id).project_id
        for k,v in x.model_dump(exclude={'code'}).items(): setattr(o,k,v)
        new_project=s.get(Feature,new_fn.feature_id).project_id
        refresh_rollup_statuses(s,{old_project,new_project}); s.commit(); return {'ok':True}
@app.delete('/api/pbis/{id}')
def del_pbi(id:int):
    with SessionLocal() as s:
        o=s.get(PBI,id)
        if not o: raise HTTPException(404)
        project_id=s.get(Feature,s.get(Function,o.function_id).feature_id).project_id
        s.delete(o); s.flush(); refresh_rollup_statuses(s,[project_id]); s.commit(); return {'ok':True}

