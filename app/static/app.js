let data=[],sprints=[],developers=[],current=null,modalState=null;let activeSprintId=localStorage.getItem('projectflow_active_sprint')||'';const statuses=['Backlog','To Do','In Progress','Review','Done','Blocked'];const $=id=>document.getElementById(id);

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function cls(s){return String(s||'').toLowerCase().replaceAll(' ','')}

async function api(url,opt={}){let r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt});if(!r.ok)throw Error(await r.text());return r.json()}

async function load(){data=await api('/api/projects');sprints=await api('/api/sprints');developers=await api('/api/developers');if(current&&!data.some(p=>p.id===current))current=null;renderDashboard();renderProjectList();renderDetail();renderTracking();renderSprints();renderTeam();updateActiveSprintUI()}

function showView(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(v).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('crumb').textContent=v==='dashboard'?'Dashboard':v==='projects'?'Project Management':v==='tracking'?'Status Tracking':v==='sprints'?'Sprint Management':'Team & Responsibility';if(v==='tracking')renderTracking();if(v==='sprints'){renderSprints();updateActiveSprintUI()}if(v==='team'){renderTeam()}}

document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));

function counts(){let f=fn=pbi=0;data.forEach(p=>p.features.forEach(x=>{f++;x.functions.forEach(y=>{fn++;pbi+=y.pbis.length})}));return{p:data.length,f,fn,pbi}}

function renderDashboard() {
  const c = counts();

  $('stats').innerHTML = [
    ['Projects', c.p, 'Total projects', 'bi-folder2'],
    ['Features', c.f, 'Project capabilities', 'bi-layers'],
    ['Functions', c.fn, 'Business functions', 'bi-diagram-2'],
    ['PBIs', c.pbi, 'Work items', 'bi-check2-square']
  ].map(x => `
    <div class="kpi-card">
      <div class="kpi-icon"><i class="bi ${x[3]}"></i></div>
      <div class="kpi-content">
        <div class="label">${x[0]}</div>
        <div class="num">${x[1]}</div>
        <div class="kpi-note">${x[2]}</div>
      </div>
    </div>
  `).join('');

  $('recent').innerHTML = data.slice(0, 8).map(p => {
    const pbis = p.features.reduce((a, f) =>
      a + f.functions.reduce((b, fn) => b + fn.pbis.length, 0), 0);

    const done = p.features.reduce((a, f) =>
      a + f.functions.reduce((b, fn) =>
        b + fn.pbis.filter(x => x.status === 'Done').length, 0), 0);

    const progress = pbis ? Math.round((done / pbis) * 100) : 0;
    const fnCount = p.features.reduce((a, f) => a + f.functions.length, 0);

    return `
      <tr onclick="selectProject(${p.id})" class="dashboard-project-row">
        <td>
          <div class="project-cell">
            <div class="project-avatar">${esc((p.code || 'P').slice(0, 2))}</div>
            <div>
              <b>${esc(p.code)}</b>
              <div class="muted project-subtitle">${esc(p.name)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="progress-cell">
            <span>${progress}%</span>
            <div class="mini-progress"><span style="width:${progress}%"></span></div>
          </div>
        </td>
        <td>
          <span class="structure-count">${p.features.length} F</span>
          <span class="structure-count">${fnCount} Fn</span>
          <span class="structure-count">${pbis} PBI</span>
        </td>
        <td><span class="badge ${cls(p.status)}">${esc(p.status)}</span></td>
        <td><i class="bi bi-chevron-right row-arrow"></i></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="empty">ยังไม่มี Project</td></tr>';

  const featured = data[0];
  if (featured) {
    const pbis = featured.features.reduce((a, f) =>
      a + f.functions.reduce((b, fn) => b + fn.pbis.length, 0), 0);
    const done = featured.features.reduce((a, f) =>
      a + f.functions.reduce((b, fn) => b + fn.pbis.filter(x => x.status === 'Done').length, 0), 0);
    const progress = pbis ? Math.round((done / pbis) * 100) : 0;

    $('featuredProject').innerHTML = `
      <div class="featured-label">FEATURED PROJECT</div>
      <div class="featured-code">${esc(featured.code)}</div>
      <h2>${esc(featured.name)}</h2>
      <p>${esc(featured.description || 'ยังไม่มีคำอธิบาย Project')}</p>

      <div class="featured-meta">
        <div>
          <strong>${featured.features.length}</strong>
          <span>Features</span>
        </div>
        <div>
          <strong>${featured.features.reduce((a, f) => a + f.functions.length, 0)}</strong>
          <span>Functions</span>
        </div>
        <div>
          <strong>${pbis}</strong>
          <span>PBIs</span>
        </div>
      </div>

      <div class="featured-progress">
        <div class="d-flex justify-content-between">
          <span>Completion</span>
          <strong>${progress}%</strong>
        </div>
        <div class="featured-progress-bar"><span style="width:${progress}%"></span></div>
      </div>

      <div class="featured-footer">
        <span class="badge ${cls(featured.status)}">${esc(featured.status)}</span>
        <button class="btn" onclick="selectProject(${featured.id})">
          View Project <i class="bi bi-arrow-up-right"></i>
        </button>
      </div>
    `;
  } else {
    $('featuredProject').innerHTML = `
      <div class="empty featured-empty">
        <i class="bi bi-folder-plus"></i>
        <div>ยังไม่มี Project</div>
        <button class="btn mt-3" onclick="openProject()">Create Project</button>
      </div>
    `;
  }

  const active = sprints.find(x => String(x.id) === String(activeSprintId));
  $('sprintOverview').innerHTML = active ? `
    <div class="sprint-hero">
      <div class="sprint-icon"><i class="bi bi-lightning-charge"></i></div>
      <div>
        <div class="muted small">${esc(active.period_type)} Sprint</div>
        <strong>${esc(active.code)}</strong>
        <div class="muted small">${esc(active.name)}</div>
      </div>
    </div>
    <div class="sprint-date">${esc(active.start_date)} <span>→</span> ${esc(active.end_date)}</div>
    <button class="btn secondary w-100" onclick="showView('sprints')">Manage Sprint</button>
  ` : `
    <div class="empty compact-empty">
      <i class="bi bi-calendar2-plus"></i>
      <div>ยังไม่ได้เลือก Active Sprint</div>
      <button class="btn secondary mt-3" onclick="showView('sprints')">Select Sprint</button>
    </div>
  `;

  const statusCounts = { 'Backlog': 0, 'To Do': 0, 'In Progress': 0, 'Review': 0, 'Done': 0, 'Blocked': 0 };
  data.forEach(p => p.features.forEach(f => f.functions.forEach(fn => fn.pbis.forEach(b => {
    if (statusCounts[b.status] !== undefined) statusCounts[b.status]++;
  }))));

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
  $('statusOverview').innerHTML = Object.entries(statusCounts).map(([name, value]) => `
    <div class="status-row">
      <div class="status-name">
        <span class="status-dot ${cls(name)}"></span>
        <span>${name}</span>
      </div>
      <strong>${value}</strong>
      <div class="status-track"><span class="${cls(name)}" style="width:${Math.round(value / total * 100)}%"></span></div>
    </div>
  `).join('');

  const breakdown = data.slice(0, 5);
  $('breakdownList').innerHTML = breakdown.length ? breakdown.map(p => `
    <div class="breakdown-item" onclick="selectProject(${p.id})">
      <div class="breakdown-avatar">${esc((p.code || 'P').slice(0, 2))}</div>
      <div class="breakdown-main">
        <strong>${esc(p.code)}</strong>
        <span>${esc(p.name)}</span>
      </div>
      <i class="bi bi-chevron-right"></i>
    </div>
  `).join('') : '<div class="empty compact-empty">ยังไม่มีข้อมูล</div>';
}

function renderProjectList(){let q=($('projectSearch')?.value||'').toLowerCase();$('projectList').innerHTML=data.filter(p=>(p.code+' '+p.name).toLowerCase().includes(q)).map(p=>`<div class="project-item ${current===p.id?'selected':''}" onclick="selectProject(${p.id})"><div class="project-code">${esc(p.code)}</div><div class="project-name">${esc(p.name)}</div><div style="margin-top:7px"><span class="badge ${cls(p.status)}">${esc(p.status)}</span></div></div>`).join('')||'<div class="empty">ไม่พบ Project</div>'}

function selectProject(id){current=id;renderProjectList();renderDetail();showView('projects')}

function projectById(id){return data.find(p=>p.id===id)}

function renderDetail(){let p=projectById(current);if(!p){$('projectDetail').innerHTML='<div class="empty">เลือก Project จากด้านซ้ายเพื่อเริ่มจัดการ</div>';return}let f=p.features.length,fn=p.features.reduce((a,x)=>a+x.functions.length,0),pb=p.features.reduce((a,x)=>a+x.functions.reduce((b,y)=>b+y.pbis.length,0),0);$('projectDetail').innerHTML=`<div class="detail-top"><div style="display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div class="muted" style="font-size:11px;font-weight:800">${esc(p.code)}</div><h2>${esc(p.name)}</h2><p>${esc(p.description||'ยังไม่มีคำอธิบาย Project')}</p><div class="detail-meta"><span class="badge ${cls(p.status)}">${esc(p.status)}</span><span class="muted" style="font-size:12px">${f} Features · ${fn} Functions · ${pb} PBIs</span></div></div><div class="actions"><button class="iconbtn" onclick="openProject(${p.id})">Edit</button><button class="iconbtn red" onclick="deleteEntity('project',${p.id})">Delete</button></div></div></div><div class="tabs"><button class="tab active" onclick="tab(this,'overview')">Overview</button><button class="tab" onclick="tab(this,'features')">Features <span class="badge">${f}</span></button><button class="tab" onclick="tab(this,'functions')">Functions <span class="badge">${fn}</span></button><button class="tab" onclick="tab(this,'pbis')">PBIs <span class="badge">${pb}</span></button></div><div id="overview" class="tab-page active"><div class="definition"><div class="def"><strong>Project</strong><span>โครงการหรือเป้าหมายหลักที่ต้องการบริหาร</span></div><div class="def"><strong>Feature</strong><span>ความสามารถหลักของ Project ที่ต้องส่งมอบ</span></div><div class="def"><strong>Function</strong><span>ฟังก์ชันหรือกระบวนการย่อยภายใน Feature</span></div><div class="def"><strong>PBI</strong><span>รายการงาน/ความต้องการที่ทีมพัฒนาและติดตาม</span></div></div><div class="info-box"><b>Project hierarchy</b><div class="hierarchy"><span>Project</span><i class="arrow">→</i><span>Feature</span><i class="arrow">→</i><span>Function</span><i class="arrow">→</i><span>PBI</span></div></div><div class="panel project-members-panel"><div class="panel-head"><div><div class="panel-kicker">PROJECT TEAM</div><h3>People responsible</h3></div><button class="btn btn-sm" onclick="openProjectMember(${p.id})"><i class="bi bi-person-plus"></i> Assign</button></div><div id="projectMembers-${p.id}" class="project-members"></div></div><div class="panel"><div class="panel-head"><h3>Project Summary</h3></div><div style="padding:18px"><div class="muted" style="font-size:12px;margin-bottom:7px">Description</div><div>${esc(p.description||'ยังไม่มีรายละเอียด')}</div></div></div></div><div id="features" class="tab-page">${featurePage(p)}</div><div id="functions" class="tab-page">${functionPage(p)}</div><div id="pbis" class="tab-page">${pbiPage(p)}</div>`; renderProjectMembers(p) }

function tab(el,id){el.parentElement.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));el.classList.add('active');el.closest('.detail').querySelectorAll('.tab-page').forEach(x=>x.classList.remove('active'));$(id).classList.add('active')}

function featurePage(p){return `<div class="section-head"><h3>Features</h3><button class="btn" onclick="openFeature(null,${p.id})">+ Add Feature</button></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Feature</th><th>Status</th><th>Functions</th><th></th></tr></thead><tbody>${p.features.map(f=>`<tr><td><b>${esc(f.code)}</b></td><td>${esc(f.name)}</td><td><span class="badge ${cls(f.status)}">${esc(f.status)}</span> <span class="auto-status">AUTO</span></td><td>${f.functions.length}</td><td><div class="actions"><button class="iconbtn" onclick="openFeature(${f.id},${p.id})">Edit</button><button class="iconbtn red" onclick="deleteEntity('feature',${f.id})">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="empty">ยังไม่มี Feature</td></tr>'}</tbody></table></div></div>`}

function functionPage(p){let rows=[];p.features.forEach(f=>f.functions.forEach(fn=>rows.push(`<tr><td><b>${esc(fn.code)}</b></td><td>${esc(fn.name)}</td><td>${esc(f.code)}</td><td><span class="badge ${cls(fn.status)}">${esc(fn.status)}</span> <span class="auto-status">AUTO</span></td><td>${fn.pbis.length}</td><td><div class="actions"><button class="iconbtn" onclick="openFunction(${fn.id},${f.id})">Edit</button><button class="iconbtn red" onclick="deleteEntity('function',${fn.id})">Delete</button></div></td></tr>`)));return `<div class="section-head"><h3>Functions</h3><button class="btn" onclick="openFunction(null,${p.features[0]?.id||''})" ${p.features.length?'':'disabled'}>+ Add Function</button></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Function</th><th>Feature</th><th>Status</th><th>PBIs</th><th></th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="6" class="empty">ยังไม่มี Function</td></tr>'}</tbody></table></div></div>`}

function pbiPage(p){let rows=[];p.features.forEach(f=>f.functions.forEach(fn=>fn.pbis.forEach(b=>rows.push(`<tr><td><b>${esc(b.code)}</b></td><td>${esc(b.title)}</td><td>${esc(fn.code)}</td><td><span class="badge ${cls(b.status)}">${esc(b.status)}</span></td><td><span class="badge ${cls(b.priority)}">${esc(b.priority)}</span></td><td>${esc(sprints.find(sp=>sp.id===b.sprint_id)?.code||'—')}</td><td><div class="actions"><button class="iconbtn" onclick="openPBI(${b.id},${fn.id})">Edit</button><button class="iconbtn red" onclick="deleteEntity('pbi',${b.id})">Delete</button></div></td></tr>`))));let fn=p.features.flatMap(f=>f.functions);return `<div class="section-head"><h3>PBIs</h3><button class="btn" onclick="openPBI(null,${fn[0]?.id||''})" ${fn.length?'':'disabled'}>+ Add PBI</button></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Title</th><th>Function</th><th>Status</th><th>Priority</th><th>Sprint</th><th></th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="7" class="empty">ยังไม่มี PBI</td></tr>'}</tbody></table></div></div>`}

function autoStatusHint(status) {
  return `<div class="auto-status-box"><i class="bi bi-magic"></i><div><strong>Auto Status</strong><span>${esc(status || 'Backlog')} — calculated from child items</span></div></div>`;
}

function openProject(id=null){
  let p=id?projectById(id):null;
  modalState={type:'project',id};
  $('modalTitle').textContent=p?'Edit Project':'New Project';
  $('modalBody').innerHTML=`
    <div class="field"><label>Project ID <span class="auto-status">AUTO</span></label><input id="f_code" value="${esc(p?.code||'Generated automatically')}" disabled></div>
    <div class="field"><label>Project Name</label><input id="f_name" value="${esc(p?.name||'')}"></div>
    <div class="field"><label>Description</label><textarea id="f_desc">${esc(p?.description||'')}</textarea></div>
    ${p ? autoStatusHint(p.status) : '<div class="auto-status-box"><i class="bi bi-magic"></i><div><strong>Auto Status</strong><span>Status will be calculated from Features → Functions → PBIs</span></div></div>'}
  `;
  openModal();
}

function openFeature(id,parent){
  let f=find('feature',id);
  modalState={type:'feature',id,parent};
  $('modalTitle').textContent=f?'Edit Feature':'New Feature';
  $('modalBody').innerHTML=`
    <div class="field"><label>Project</label><select id="f_parent">${data.map(x=>`<option value="${x.id}" ${x.id===parent?'selected':''}>${esc(x.code)} — ${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Feature ID <span class="auto-status">AUTO</span></label><input id="f_code" value="${esc(f?.code||'Generated automatically')}" disabled></div>
    <div class="field"><label>Feature Name</label><input id="f_name" value="${esc(f?.name||'')}"></div>
    ${autoStatusHint(f?.status || 'Backlog')}
  `;
  openModal();
}

function openFunction(id,parent){
  let x=find('function',id),opts=[];
  data.forEach(pp=>pp.features.forEach(f=>opts.push(`<option value="${f.id}" ${f.id===parent?'selected':''}>${esc(pp.code)} / ${esc(f.code)} — ${esc(f.name)}</option>`)));
  modalState={type:'function',id,parent};
  $('modalTitle').textContent=x?'Edit Function':'New Function';
  $('modalBody').innerHTML=`
    <div class="field"><label>Feature</label><select id="f_parent">${opts.join('')}</select></div>
    <div class="field"><label>Function ID <span class="auto-status">AUTO</span></label><input id="f_code" value="${esc(x?.code||'Generated automatically')}" disabled></div>
    <div class="field"><label>Function Name</label><input id="f_name" value="${esc(x?.name||'')}"></div>
    ${autoStatusHint(x?.status || 'Backlog')}
  `;
  openModal();
}

function openPBI(id,parent){
  let x=find('pbi',id),opts=[];
  data.forEach(pp=>pp.features.forEach(f=>f.functions.forEach(fn=>opts.push(`<option value="${fn.id}" ${fn.id===parent?'selected':''}>${esc(pp.code)} / ${esc(fn.code)} — ${esc(fn.name)}</option>`))));
  modalState={type:'pbi',id,parent};
  $('modalTitle').textContent=x?'Edit PBI':'New PBI';
  $('modalBody').innerHTML=`
    <div class="field"><label>Function</label><select id="f_parent">${opts.join('')}</select></div>
    <div class="field"><label>Sprint</label><select id="f_sprint"><option value="">No Sprint</option>${sprints.map(sp=>`<option value="${sp.id}" ${String(sp.id)===String(x?.sprint_id||activeSprintId)?'selected':''}>${esc(sp.code)} — ${esc(sp.name)}</option>`).join('')}</select></div>
    <div class="field"><label>PBI ID <span class="auto-status">AUTO</span></label><input id="f_code" value="${esc(x?.code||'Generated automatically')}" disabled></div>
    <div class="field"><label>PBI Title</label><input id="f_name" value="${esc(x?.title||'')}"></div>
    <div class="field"><label>Status</label>${statusSelect(x?.status)}</div>
    <div class="field"><label>Priority</label><select id="f_priority">${['Low','Medium','High','Critical'].map(v=>`<option ${v===x?.priority?'selected':''}>${v}</option>`).join('')}</select></div>
  `;
  openModal();
}

function statusSelect(v){return `<select id="f_status">${statuses.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}</select>`}

function find(type,id){for(let p of data)for(let f of p.features){if(type==='feature'&&f.id===id)return f;for(let fn of f.functions){if(type==='function'&&fn.id===id)return fn;for(let b of fn.pbis)if(type==='pbi'&&b.id===id)return b}}return null}

async function saveModal(){
  let s=modalState,t=s.type;
  try{
    if(t==='developer'){const body={name:$('f_name').value.trim(),email:$('f_email').value.trim(),title:$('f_title').value.trim(),active:$('f_active').value==='true'};await api('/api/developers'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});}else if(t==='member'){const body={developer_id:+$('f_developer').value,role:$('f_role').value};await api('/api/projects/'+s.projectId+'/members'+(s.developerId?'/'+s.developerId:''),{method:s.developerId?'PUT':'POST',body:JSON.stringify(body)});}else if(t==='sprint'){
      const body={code:$('f_code').value.trim(),status:$('f_status').value,name:$('f_name').value.trim(),period_type:$('f_period').value,start_date:$('f_start').value,end_date:$('f_end').value,description:$('f_desc').value};
      await api('/api/sprints'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});
    }else if(t==='project'){
      const body={code:'',name:$('f_name').value.trim(),description:$('f_desc').value};
      await api('/api/projects'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});
    }else if(t==='feature'){
      const body={code:$('f_code').value.trim(),name:$('f_name').value.trim(),description:'',project_id:+$('f_parent').value};
      await api('/api/features'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});
    }else if(t==='function'){
      const body={code:$('f_code').value.trim(),name:$('f_name').value.trim(),description:'',feature_id:+$('f_parent').value};
      await api('/api/functions'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});
    }else{
      const body={code:$('f_code').value.trim(),title:$('f_name').value.trim(),description:'',function_id:+$('f_parent').value,status:$('f_status').value,priority:$('f_priority').value,sprint_id:$('f_sprint').value?+$('f_sprint').value:null};
      await api('/api/pbis'+(s.id?'/'+s.id:''),{method:s.id?'PUT':'POST',body:JSON.stringify(body)});
    }
    closeModal();
    toast('บันทึกข้อมูลแล้ว — Status ถูกคำนวณอัตโนมัติ');
    await load();
  }catch(e){toast(e.message)}
}

async function deleteEntity(type,id){if(!confirm('ยืนยันการลบ? รายการลูกภายใต้รายการนี้จะถูกลบด้วย'))return;try{await api('/api/'+({project:'projects',feature:'features',function:'functions',pbi:'pbis'}[type])+'/'+id,{method:'DELETE'});if(type==='project'&&current===id)current=null;toast('ลบข้อมูลแล้ว');await load()}catch(e){toast(e.message)}}

function renderTracking(){let st=$('trackStatus')?.value||'all',q=($('trackSearch')?.value||'').toLowerCase(),rows=[];data.forEach(p=>p.features.forEach(f=>{if(ok('Feature',f.code,f.name,f.status))rows.push(row('Feature',f,p.name,'Project'));f.functions.forEach(fn=>{if(ok('Function',fn.code,fn.name,fn.status))rows.push(row('Function',fn,f.name,p.name));fn.pbis.forEach(b=>{if(ok('PBI',b.code,b.title,b.status))rows.push(row('PBI',b,fn.name,p.name))})})}));$('trackingBody').innerHTML=rows.join('')||'<tr><td colspan="7" class="empty">ไม่พบข้อมูล</td></tr>';

function ok(t,c,n,s){return(st==='all'||st===s)&&(`${t} ${c} ${n} ${s}`).toLowerCase().includes(q)}function row(t,x,parent,project){return `<tr><td><span class="badge">${t}</span></td><td><b>${esc(x.code)}</b></td><td>${esc(x.name||x.title)}</td><td>${esc(project)}</td><td>${esc(parent)}</td><td><span class="badge ${cls(x.status)}">${esc(x.status)}</span></td><td>${t==='PBI'?`<span class="badge ${cls(x.priority)}">${esc(x.priority)}</span>`:'—'}</td><td>${t==='PBI'?esc(sprints.find(sp=>sp.id===x.sprint_id)?.code||'—'):'—'}</td></tr>`}}

function renderSprints(){if(!$('sprintBody'))return;$('sprintCount').textContent=`${sprints.length} Sprint(s)`;$('activeSprintSelect').innerHTML='<option value="">— No Active Sprint —</option>'+sprints.map(sp=>`<option value="${sp.id}" ${String(sp.id)===String(activeSprintId)?'selected':''}>${esc(sp.code)} — ${esc(sp.name)} (${esc(sp.period_type)})</option>`).join('');$('sprintBody').innerHTML=sprints.map(sp=>`<tr><td><b>${esc(sp.code)}</b></td><td>${esc(sp.name)}</td><td><span class="badge">${esc(sp.period_type)}</span></td><td>${esc(sp.start_date)} → ${esc(sp.end_date)}</td><td><span class="badge ${cls(sp.status)}">${esc(sp.status)}</span></td><td><div class="actions"><button class="iconbtn" onclick="openSprint(${sp.id})">Edit</button><button class="iconbtn red" onclick="deleteSprint(${sp.id})">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">ยังไม่มี Sprint</td></tr>'}

function setActiveSprint(id){activeSprintId=id||'';if(activeSprintId)localStorage.setItem('projectflow_active_sprint',activeSprintId);else localStorage.removeItem('projectflow_active_sprint');updateActiveSprintUI();toast(activeSprintId?'เลือก Active Sprint แล้ว':'ยกเลิก Active Sprint แล้ว')}

function updateActiveSprintUI(){let sp=sprints.find(x=>String(x.id)===String(activeSprintId));$('activeSprintTop').textContent=sp?`${sp.code} · ${sp.name}`:'No Active Sprint';$('activeSprintTop').className='badge '+(sp?'active':'');if($('activeSprintSelect'))$('activeSprintSelect').value=sp?sp.id:'';if($('activeSprintInfo'))$('activeSprintInfo').innerHTML=sp?`<div><b>${esc(sp.code)} — ${esc(sp.name)}</b></div><div class="muted mt-1">${esc(sp.start_date)} → ${esc(sp.end_date)} · ${esc(sp.period_type)}</div>`:'ยังไม่ได้เลือก Sprint ที่กำลังทำงาน'}

function openSprint(id=null){let x=id?sprints.find(s=>s.id===id):null;modalState={type:'sprint',id};$('modalTitle').textContent=x?'Edit Sprint':'New Sprint';$('modalBody').innerHTML=`<div class="field"><label>Sprint ID <span class="auto-status">AUTO</span></label><input id="f_code" value="${esc(x?.code||'Generated automatically')}" disabled></div><div class="field"><label>Sprint Name</label><input id="f_name" value="${esc(x?.name||'')}"></div><div class="field"><label>Period Type</label><select id="f_period"><option ${x?.period_type==='Week'?'selected':''}>Week</option><option ${x?.period_type==='Month'?'selected':''}>Month</option></select></div><div class="field"><label>Start Date</label><input type="date" id="f_start" value="${esc(x?.start_date||'')}"></div><div class="field"><label>End Date</label><input type="date" id="f_end" value="${esc(x?.end_date||'')}"></div><div class="field"><label>Status</label><select id="f_status"><option ${x?.status==='Planned'?'selected':''}>Planned</option><option ${x?.status==='Active'?'selected':''}>Active</option><option ${x?.status==='Completed'?'selected':''}>Completed</option><option ${x?.status==='Cancelled'?'selected':''}>Cancelled</option></select></div><div class="field"><label>Description</label><textarea id="f_desc">${esc(x?.description||'')}</textarea></div>`;openModal()}

async function deleteSprint(id){if(!confirm('ยืนยันการลบ Sprint?'))return;try{await api('/api/sprints/'+id,{method:'DELETE'});if(String(activeSprintId)===String(id))setActiveSprint('');toast('ลบ Sprint แล้ว');await load()}catch(e){toast(e.message)}}


function renderTeam() {
  if (!$('developerBody')) return;
  $('developerCount').textContent = `${developers.length} people`;
  $('developerBody').innerHTML = developers.map(d => `
    <tr>
      <td><div class="person-cell"><div class="member-avatar">${esc((d.name||'U').split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><strong>${esc(d.name)}</strong><div class="muted small">${esc(d.email||'')}</div></div></div></td>
      <td>${esc(d.title||'Developer')}</td>
      <td><span class="project-pill-count">${d.projects.length}</span> project${d.projects.length===1?'':'s'}</td>
      <td><span class="badge ${d.active?'done':'blocked'}">${d.active?'Active':'Inactive'}</span></td>
      <td><div class="actions"><button class="iconbtn" onclick="openDeveloper(${d.id})">Edit</button><button class="iconbtn red" onclick="deleteDeveloper(${d.id})">Delete</button></div></td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">ยังไม่มี Developer</td></tr>';

  $('responsibilityMap').innerHTML = developers.map(d => `
    <div class="responsibility-person">
      <div class="person-cell"><div class="member-avatar">${esc((d.name||'U').split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><strong>${esc(d.name)}</strong><span>${esc(d.title||'Developer')}</span></div></div>
      <div class="responsibility-projects">${d.projects.length ? d.projects.map(p=>`<div class="responsibility-project"><b>${esc(p.code)}</b><span>${esc(p.name)}</span><em>${esc(p.role)}</em></div>`).join('') : '<span class="muted">No project assigned</span>'}</div>
    </div>`).join('') || '<div class="empty">ยังไม่มี Developer</div>';
}

function openDeveloper(id=null) {
  const d=id ? developers.find(x=>x.id===id) : null;
  modalState={type:'developer',id};
  $('modalTitle').textContent=d?'Edit Developer':'Add Developer';
  $('modalBody').innerHTML=`<div class="field"><label>Name</label><input id="f_name" value="${esc(d?.name||'')}"></div><div class="field"><label>Email</label><input id="f_email" value="${esc(d?.email||'')}"></div><div class="field"><label>Title</label><input id="f_title" value="${esc(d?.title||'Developer')}"></div><div class="field"><label>Status</label><select id="f_active"><option value="true" ${d?.active!==false?'selected':''}>Active</option><option value="false" ${d?.active===false?'selected':''}>Inactive</option></select></div>`;
  openModal();
}

function openProjectMember(projectId, developerId=null) {
  const p=projectById(projectId);
  if(!p) return;
  const assigned=new Set((p.members||[]).map(m=>m.id));
  const existing=developerId ? (p.members||[]).find(m=>m.id===developerId) : null;
  modalState={type:'member',projectId,developerId};
  $('modalTitle').textContent=existing?'Edit Project Responsibility':'Assign Developer';
  $('modalBody').innerHTML=`<div class="field"><label>Project</label><input value="${esc(p.code)} — ${esc(p.name)}" disabled></div><div class="field"><label>Developer</label><select id="f_developer" ${existing?'disabled':''}>${developers.filter(d=>!assigned.has(d.id)||d.id===developerId).map(d=>`<option value="${d.id}" ${d.id===developerId?'selected':''}>${esc(d.name)} — ${esc(d.title||'Developer')}</option>`).join('')}</select></div><div class="field"><label>Project Role</label><select id="f_role">${['Project Owner','Tech Lead','Developer','Reviewer','Support'].map(r=>`<option ${r===(existing?.role||'Developer')?'selected':''}>${r}</option>`).join('')}</select></div>`;
  openModal();
}

async function removeProjectMember(projectId,developerId){
  if(!confirm('นำ Developer คนนี้ออกจาก Project ใช่หรือไม่?')) return;
  try { await api(`/api/projects/${projectId}/members/${developerId}`,{method:'DELETE'}); toast('นำผู้รับผิดชอบออกแล้ว'); await load(); } catch(e){toast(e.message)}
}

async function deleteDeveloper(id){
  if(!confirm('ลบ Developer คนนี้หรือไม่? การลบจะนำออกจากทุก Project ด้วย')) return;
  try { await api('/api/developers/'+id,{method:'DELETE'}); toast('ลบ Developer แล้ว'); await load(); } catch(e){toast(e.message)}
}

function openModal(){$('modal').classList.add('open')}function closeModal(){$('modal').classList.remove('open')}function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}function tick(){$('clock').textContent=new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}tick();setInterval(tick,1000);load().catch(e=>toast(e.message));
