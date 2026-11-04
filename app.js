"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const pretty = (value) => JSON.stringify(value, null, 2);
const metrics = ["Language", "Camera", "Robot", "Light", "Background", "Noise", "Layout", "Overall"];
const results = [
  {name:"Qwen3.5-4B",group:"Baseline",values:[92.3,60.7,59.6,94.4,96.2,88.0,79.4,80.2]},
  {name:"Generalist VQA",group:"Reference adaptation",values:[93.4,61.0,61.9,98.2,97.8,84.1,82.8,81.3]},
  {name:"Spatial VQA",group:"Capability-specific",values:[92.7,62.0,63.7,94.7,97.2,81.0,82.2,80.6]},
  {name:"Pointing VQA",group:"Capability-specific",values:[92.8,65.9,60.3,95.9,96.0,86.8,80.5,81.4]},
  {name:"Affordance & Placement VQA",group:"Capability-specific",values:[92.9,65.9,65.9,96.9,95.8,82.1,81.2,81.7]},
  {name:"Cross-view consistency VQA",group:"Spatial split",featured:true,values:[92.5,67.8,68.8,97.4,95.9,86.5,81.4,83.2]},
  {name:"Single-view spatial VQA",group:"Spatial split",values:[90.9,64.4,59.4,95.7,95.9,88.1,80.2,80.8]},
  {name:"Visible object pointing VQA",group:"Pointing split",values:[93.1,65.5,62.1,95.5,97.0,83.8,79.4,81.1]},
  {name:"Visible + absent pointing VQA",group:"Pointing split",values:[90.2,58.7,64.7,96.8,95.3,85.5,80.9,80.4]},
  {name:"Interaction-point grounding VQA",group:"Affordance split",values:[91.4,64.2,60.1,95.8,96.4,84.1,80.7,80.5]},
  {name:"Destination-point grounding VQA",group:"Affordance split",values:[91.4,60.6,62.3,95.8,95.0,84.9,79.2,80.0]}
];

let resultMode = 'delta';
function renderResults() {
  const metric = $('#metric').value, index = metrics.indexOf(metric);
  const baseline = results[0].values[index];
  const ordered = [...results];
  if ($('#sort-results').checked) ordered.sort((a,b) => b.values[index] - a.values[index]);
  const best = Math.max(...results.map(row => row.values[index]));
  const leaders = results.filter(row => row.values[index] === best);
  const delta = value => +(value - baseline).toFixed(1);
  const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`;
  const extent = Math.max(1, Math.ceil(Math.max(...results.map(row => Math.abs(delta(row.values[index]))))));
  const x = value => resultMode === 'delta' ? 50 + value / extent * 50 : value;
  $('#result-context').innerHTML = `<div><span>${escapeHTML(metric.toUpperCase())} · ${resultMode === 'delta' ? 'GAIN OVER BASELINE' : 'ABSOLUTE SUCCESS'}</span><h3>${leaders.map(row => escapeHTML(row.name)).join(' / ')} leads this comparison.</h3></div><p>Baseline: <b>${baseline.toFixed(1)}%</b><br>${resultMode === 'delta' ? 'Right of zero = improved success' : 'Full success-rate scale: 0–100%'}</p>`;
  $('#result-chart-unit').textContent = resultMode === 'delta' ? 'Change in percentage points (pp)' : 'Success rate (%)';
  $('#result-bars').dataset.mode = resultMode;
  $('#result-bars').innerHTML = '<div class="results-chart-head" aria-hidden="true"><span>Backbone initialization</span><span></span><span>Success</span><span>Δ vs base</span></div>' + ordered.map(row => {
    const value = row.values[index], change = delta(value), leader = value === best;
    const left = resultMode === 'delta' ? Math.min(50, x(change)) : 0;
    const width = resultMode === 'delta' ? Math.abs(change) / extent * 50 : value;
    const classes = `${leader ? 'metric-best' : ''} ${row.featured ? 'featured' : ''} ${row.group === 'Baseline' ? 'baseline' : ''} ${change < 0 ? 'negative' : ''}`;
    return `<div class="result-row ${classes}" data-name="${escapeHTML(row.name)}" data-score="${value}" data-change="${change}"><div class="result-label"><strong>${escapeHTML(row.name)}</strong>${leader ? '<span class="result-leader">Best</span>' : row.featured ? '<span class="result-focus">Study focus</span>' : ''}<small>${escapeHTML(row.group)}</small></div><div class="result-plot" role="img" aria-label="${escapeHTML(row.name)}: ${value.toFixed(1)}% ${escapeHTML(metric)} success, ${signed(change)} percentage points versus baseline"><i class="result-zero" aria-hidden="true"></i><div class="result-fill" style="left:${left}%;width:${width}%"></div>${change === 0 && resultMode === 'delta' ? '<i class="result-origin" aria-hidden="true"></i>' : ''}</div><span class="result-score">${value.toFixed(1)}<small>%</small></span><strong class="result-change">${row.group === 'Baseline' ? '—' : signed(change)}</strong></div>`;
  }).join('');
  const ticks = resultMode === 'delta' ? [-extent, -extent/2, 0, extent/2, extent] : [0,25,50,75,100];
  $('#result-bars').insertAdjacentHTML('beforeend', `<div class="result-axis" aria-hidden="true">${ticks.map(tick => `<span style="left:${resultMode === 'delta' ? x(tick) : tick}%">${resultMode === 'delta' ? (tick === 0 ? '0' : `${tick > 0 ? '+' : '−'}${Math.abs(tick)}`) : tick}</span>`).join('')}</div>`);
  $$('[data-result-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.resultMode === resultMode)));
  $$('[data-highlight-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.highlightMetric === metric)));
  $('#results-table').innerHTML = '<caption>LIBERO-plus policy results from Table 2 (%)</caption><thead><tr><th scope="col">Initialization</th>' + metrics.map(m => `<th scope="col">${m}</th>`).join('') + '</tr></thead><tbody>' + results.map(row => `<tr class="${row.featured ? 'featured' : ''}"><th scope="row">${escapeHTML(row.name)}</th>${row.values.map(v => `<td>${v.toFixed(1)}</td>`).join('')}</tr>`).join('') + '</tbody>';
}
$('#metric').addEventListener('change', renderResults);
$('#sort-results').addEventListener('change', renderResults);
$$('[data-result-mode]').forEach(button => button.addEventListener('click', () => { resultMode = button.dataset.resultMode; renderResults(); }));
$$('[data-highlight-metric]').forEach(button => button.addEventListener('click', () => { $('#metric').value = button.dataset.highlightMetric; renderResults(); }));
renderResults();

const comparisons = {
  views:{kicker:"SINGLE VIEW → CROSS VIEW",title:"A lower VLM average. A stronger policy.",description:"Changing from single-view spatial VQA to cross-view consistency VQA lowers the embodied VLM average, while improving downstream policy success. The policy advantage is concentrated in camera and robot-state perturbations.",from:{name:"Single-view",x:55.86,y:80.81},to:{name:"Cross-view",x:54.85,y:83.16},page:7},
  source:{kicker:"ROBOCASA → DROID + ROBOCASA",title:"Real episodes improve the policy, despite a lower VLM score.",description:"At the same Generalist question budget, mixing DROID with RoboCasa questions improves overall policy success over the RoboCasa-only recipe. The VLM benchmark average moves in the opposite direction.",from:{name:"RoboCasa Generalist",x:56.11,y:81.27},to:{name:"DROID + RoboCasa",x:55.51,y:82.19},page:8},
  interface:{kicker:"MULTIPLE CHOICE → DIRECT GENERATION",title:"Removing options reverses the ranking again.",description:"Cross-view direct generation raises the VLM average but lowers policy success relative to MCQ. This intervention changes candidate availability, the answer target, and its verifier; it is more than a text-format change.",from:{name:"Cross-view MCQ",x:54.85,y:83.16},to:{name:"Direct generation",x:55.53,y:80.87},page:9}
};
const plotPoints = [{name:"Baseline",x:56.56,y:80.20},{name:"Generalist",x:56.11,y:81.27},{name:"Single-view",x:55.86,y:80.81},{name:"Cross-view",x:54.85,y:83.16},{name:"+ Depth",x:56.76,y:79.60},{name:"DROID + RoboCasa",x:55.51,y:82.19},{name:"DROID Cross-view",x:55.45,y:81.90},{name:"Direct generation",x:55.53,y:80.87}];
function renderComparison(key) {
  const c = comparisons[key];
  $("#comparison-kicker").textContent = c.kicker;
  $("#comparison-title").textContent = c.title;
  $("#comparison-description").textContent = c.description;
  $("#comparison-reference").href = `assets/what-to-teach-before-acting-0156a22d.pdf#page=${c.page}`;
  const delta = (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
  $("#comparison-deltas").innerHTML = `<div class="delta"><strong>${delta(c.to.x-c.from.x)}</strong><small>VLM average</small></div><div class="delta"><strong>${delta(c.to.y-c.from.y)} pp</strong><small>Policy success</small></div>`;
  const x = (value) => 70 + (value-54.3)/2.9*340;
  const y = (value) => 286 - (value-79)/5*237;
  const x1=x(c.from.x),y1=y(c.from.y),x2=x(c.to.x),y2=y(c.to.y),len=Math.hypot(x2-x1,y2-y1);
  let svg = `<svg viewBox="0 0 455 342" role="img" aria-label="${escapeHTML(c.from.name)}: VLM ${c.from.x}, policy ${c.from.y} percent; ${escapeHTML(c.to.name)}: VLM ${c.to.x}, policy ${c.to.y} percent."><defs><marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#2457de" stroke-width="1.3"/></marker></defs>`;
  [79,80,81,82,83,84].forEach(v => {svg+=`<line x1="65" y1="${y(v)}" x2="420" y2="${y(v)}" stroke="#e5eaf2" stroke-dasharray="3 4"/><text x="52" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#78859a">${v}</text>`;});
  [54.5,55,55.5,56,56.5,57].forEach(v => {svg+=`<text x="${x(v)}" y="305" text-anchor="middle" font-size="10" fill="#78859a">${v}</text>`;});
  svg+='<text x="240" y="332" text-anchor="middle" font-size="11" fill="#52617a">Embodied VLM Avg.</text><text transform="translate(19 165) rotate(-90)" text-anchor="middle" font-size="11" fill="#52617a">LIBERO-plus success (%)</text>';
  plotPoints.forEach(p => {svg+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="4" fill="#cbd3df"><title>${escapeHTML(p.name)}: ${p.x}, ${p.y}%</title></circle>`;});
  svg+=`<line x1="${x1+(x2-x1)*8/len}" y1="${y1+(y2-y1)*8/len}" x2="${x2-(x2-x1)*10/len}" y2="${y2-(y2-y1)*10/len}" stroke="#2457de" stroke-width="2" marker-end="url(#arrow-head)"/>`;
  [c.from,c.to].forEach((p,i) => {
    const px=x(p.x),py=y(p.y),right=px>275;
    svg+=`<circle cx="${px}" cy="${py}" r="6" fill="${i ? '#2457de' : '#fff'}" stroke="#2457de" stroke-width="2"/><text x="${px+(right?-10:10)}" y="${py+(i?-13:20)}" text-anchor="${right?'end':'start'}" font-size="10" font-weight="600" fill="#244475">${escapeHTML(p.name)}</text>`;
  });
  svg+='</svg>';
  $("#scatter").innerHTML=svg;
  $$("[data-comparison]").forEach(b=>{const active=b.dataset.comparison===key;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
}
$$("[data-comparison]").forEach(button=>button.addEventListener("click",()=>renderComparison(button.dataset.comparison)));
renderComparison("views");

const friendlyNames = {
  object_reference:"Visible object",destination_point:"Final destination",demonstrated_contact_affordance:"Interaction point",relational_contact_placement:"Contact-region grounding",ContactDecide:"Contact decision",configuration:"Spatial configuration",Q3_secure_grasp_status:"Secure grasp status",Q4_task_completion_status:"Task completion",Success_Task:"Execution success",future_prediction:"Future prediction",immediate_planning:"Next action",immediate_planning_with_context:"Next action with context",remaining_long_horizon_planning:"Remaining plan",action_consequence:"Action consequence",multi_view_reasoning:"Cross-view reasoning",multi_view_task_consistency:"Cross-view task consistency",multi_view_phase_consistency:"Cross-view phase consistency",
  "continuous_trajectory_eval_format/sharerobot_trajectory_variable_point_format":"Gripper trajectory · variable points",
  "continuous_trajectory_eval_format/vabench_visual_trace_8point_format":"Gripper trajectory · 8 points"
};
const typeNames={point:"POINT",choice:"MULTIPLE CHOICE",traj2d:"TRAJECTORY",point_or_no_object:"POINT / NO OBJECT"};
let episodes=[],source="robocasa",stage="raw",selectedIndex=0,viewIndex=0,frameIndex=0,filter="all",revealed=false;
const currentCase = () => episodes.find(c=>c.id===source);
const currentItem = () => currentCase().items[selectedIndex];
function taskName(item) {
  const family=item.metadata.family;
  const suffix=item.target.type==="point_or_no_object" ? (item.target.expected_kind==="no_object" ? " · absent" : " · present") : "";
  if (friendlyNames[family]) return friendlyNames[family]+suffix;
  if(family.includes("|")) return family.split("|").slice(0,2).join(" · ")+suffix;
  return family.replaceAll("_"," ")+suffix;
}
function setActive(selector,attribute,value) {
  $$(selector).forEach(button=>{const active=button.dataset[attribute]===value;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
}
function setStage(value) {
  if(!episodes.length)return;
  stage=value;setActive("[data-stage]","stage",value);
  $("#episode-video").pause();
  ["raw","ir","task","vqa"].forEach(name=>$("#"+name+"-panel").hidden=(name==="task"?"tasks":name)!==value);
  if(value==="raw")renderVideo();
  if(value==="ir")renderIR();
  if(value==="tasks")renderTasks();
  if(value==="vqa")renderRecord();
}
function selectSource(id) {
  if(!episodes.length)return;
  source=id;viewIndex=0;frameIndex=0;filter="all";revealed=false;
  const c=currentCase();
  selectedIndex=c.items.findIndex(item=>item.metadata.family==="multi_view_task_consistency");
  if(selectedIndex<0)selectedIndex=0;
  $("#episode-kind").textContent=c.origin.toUpperCase();
  $("#episode-instruction").textContent=c.instruction;
  $("#download-records").href=c.base+"vqa.json";
  $("#download-targets").href=c.base+"task-targets.json";
  $("#family-search").value="";
  setActive("[data-source]","source",id);
  setActive("[data-filter]","filter","all");
  const families=new Set(c.items.map(item=>item.metadata.family)).size;
  $("#demo-stats").textContent=`${c.title} · ${c.views.length} camera views · ${families} families · ${c.items.length} VQA records`;
  $("#operator-list").innerHTML=c.operators.map((op,i)=>`<div class="operator-row"><span>${String(i+1).padStart(2,"0")}</span>${escapeHTML(op)}</div>`).join("");
  setStage(stage);
  window.dispatchEvent(new CustomEvent("episodechange", {detail:c}));
}
function cameraButtons(container,onChange) {
  const c=currentCase();
  $(container).innerHTML=c.views.map((v,i)=>`<button data-camera="${i}" class="${i===viewIndex?'active':''}" aria-pressed="${i===viewIndex}">${v.label}</button>`).join("");
  $(container).querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{viewIndex=Number(button.dataset.camera);frameIndex=0;onChange();}));
}
function renderVideo() {
  const c=currentCase(),v=c.views[viewIndex];cameraButtons("#video-views",renderVideo);
  const url=new URL(c.base+v.video,location.href).href;
  if($("#episode-video").src!==url){$("#episode-video").src=url;$("#episode-video").poster=c.base+v.frames[0].image;}
  $("#video-caption").textContent=`${v.label} · ${v.frameCount} frames · ${v.fps} fps · ${c.id==='droid'?'Recorded camera stream':'Recorded simulator-state replay'}. Video resized for web playback.`;
}
function boxSVG(box,color) {
  if(!box)return "";
  const [x1,y1,x2,y2]=box,v=currentCase().views[viewIndex];
  return `<rect x="${x1/v.width*1000}" y="${y1/v.height*1000}" width="${(x2-x1)/v.width*1000}" height="${(y2-y1)/v.height*1000}" fill="${color}15" stroke="${color}" stroke-width="3"/>`;
}
function dotSVG(point,color,r=7){return point?`<circle cx="${point[0]}" cy="${point[1]}" r="${r}" fill="${color}" stroke="white" stroke-width="3"/>`:"";}
function pathSVG(points,color) {
  if(!points.length)return "";
  return `<polyline points="${points.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`+points.map(p=>dotSVG(p,color,5)).join("");
}
function renderIR() {
  const c=currentCase(),v=c.views[viewIndex],f=v.frames[frameIndex];cameraButtons("#ir-views",renderIR);
  const showDepth=$("#show-depth").checked&&f.depthImage;
  $("#ir-image").src=c.base+(showDepth?f.depthImage:f.image);
  $("#ir-image").alt=`${c.title}, ${v.label}, source frame ${f.index}`;
  $("#ir-frame").max=v.frames.length-1;$("#ir-frame").value=frameIndex;
  $("#ir-frame-label").textContent=String(f.index)+" / "+(v.frameCount-1);
  let overlay="";
  if($("#show-object").checked)overlay+=boxSVG(f.objectBox,"#3977fa")+dotSVG(f.objectPoint,"#3977fa");
  if($("#show-gripper").checked)overlay+=boxSVG(f.gripperBox,"#1faa8c")+dotSVG(f.gripperPoint,"#1faa8c");
  if($("#show-path").checked){const pts=v.frames.slice(0,frameIndex+1).map(a=>a.gripperPoint||(a.gripperBox?[(a.gripperBox[0]+a.gripperBox[2])/2/v.width*1000,(a.gripperBox[1]+a.gripperBox[3])/2/v.height*1000]:null)).filter(Boolean);overlay+=pathSVG(pts,"#edb24d");}
  if($("#show-contact").checked&&f.contactPoints)overlay+=f.contactPoints.map(p=>dotSVG(p,"#ee8645",6)).join("");
  $("#show-contact").parentElement.hidden=c.id!=="robocasa";
  $("#depth-scale").textContent=showDepth?`${f.depthRange[0]}–${f.depthRange[1]} ${f.depthUnits==='metres'?'m':'(focal-normalized)'} · per-frame color scale`:"";
  $("#ir-overlay").innerHTML=overlay;
  const frameData={source_frame_index:f.index,camera:v.id,image_size:[v.width,v.height]};
  if(f.objectBox)frameData.object_bbox_xyxy=f.objectBox;
  if(f.gripperBox)frameData.gripper_bbox_xyxy=f.gripperBox;
  if(f.gripperPoint)frameData.eef_point_2d=f.gripperPoint;
  if(f.depth)frameData.object_depth_m=f.depth;
  if(showDepth)frameData.depth={units:f.depthUnits,display_range:f.depthRange};
  if(f.contactPoints?.length)frameData.contact_points_2d=f.contactPoints;
  $("#ir-json").textContent=pretty({episode_id:c.id+"-episode",instruction:c.instruction,anchors:c.anchors,frame:frameData,operators:c.operators});
  $("#anchor-buttons").innerHTML=Object.entries(c.anchors).map(([name,i])=>`<button data-anchor="${i}">${name} · ${i}</button>`).join("");
  $("#anchor-buttons").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{frameIndex=v.frames.reduce((best,f,i)=>Math.abs(f.index-Number(b.dataset.anchor))<Math.abs(v.frames[best].index-Number(b.dataset.anchor))?i:best,0);renderIR();}));
}
function filteredItems() {
  const query=$("#family-search").value.toLowerCase();
  return currentCase().items.map((item,i)=>({item,i})).filter(({item})=>(filter==="all"||item.target.type===filter)&&(!query||(taskName(item)+" "+item.metadata.family).toLowerCase().includes(query)));
}
function renderFamilyList() {
  const matching=filteredItems();
  $("#family-count").textContent=`${matching.length} records · ${new Set(matching.map(({item})=>item.metadata.family)).size} families`;
  $("#family-list").innerHTML=matching.length ? matching.map(({item,i})=>`<button data-item="${i}" class="${i===selectedIndex?'active':''}" aria-pressed="${i===selectedIndex}">${escapeHTML(taskName(item))}<small>${typeNames[item.target.type]}</small></button>`).join("") : '<p class="caption">No matching task families.</p>';
  $("#family-list").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{selectedIndex=Number(button.dataset.item);revealed=false;renderTasks();}));
}
function answerValue(target) {
  if(target.type==="choice")return target.correct_label;
  if(target.type==="point_or_no_object"&&target.expected_kind==="no_object")return (target.accepted_text||["No object"])[0];
  const points=target.type==="traj2d"?target.traj:(target.points||(target.point?[target.point]:[]));
  return JSON.stringify(points.map(p=>({[target.key||"point_2d"]:p})));
}
function targetOverlay(target) {
  if(target.type==="choice"||target.expected_kind==="no_object")return "";
  const points=target.type==="traj2d"?target.traj:(target.points||(target.point?[target.point]:[]));
  return target.type==="traj2d"?pathSVG(points,"#ebad36"):points.map(p=>dotSVG(p,"#3977fa",9)).join("");
}
function renderTasks() {
  const c=currentCase(),item=currentItem();renderFamilyList();
  $("#task-type").textContent=typeNames[item.target.type];
  $("#task-name").textContent=taskName(item);
  $("#task-question").textContent=item.question;
  $("#task-images").classList.toggle("single",item.images.length===1);
  $("#task-images").innerHTML=item.images.map((path,i)=>`<figure class="task-image"><div class="frame-view"><img src="${escapeHTML(c.base+path)}" alt="Input image ${i+1} for ${escapeHTML(taskName(item))}" loading="lazy">${revealed&&item.images.length===1?`<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${targetOverlay(item.target)}</svg>`:''}</div><figcaption>IMAGE ${i+1} · ${escapeHTML(path.split('/').slice(-2).join(' / '))}</figcaption></figure>`).join("");
  $("#reveal-answer").textContent=revealed?"Hide target":"Show target";
  $("#reveal-answer").setAttribute("aria-pressed",String(revealed));
  $("#answer-panel").hidden=!revealed;
  $("#answer-text").textContent=answerValue(item.target);
  $("#target-json").textContent=pretty(item.target);
  $("#task-evidence").textContent="Target source: "+item.metadata.label_source+". Family: "+item.metadata.family+".";
}
function renderRecord() {
  const c=currentCase();
  $("#record-title").textContent=taskName(currentItem());
  $("#record-json").textContent=pretty(c.records[selectedIndex]);
}
function toast(message){$("#toast").textContent=message;$("#toast").hidden=false;setTimeout(()=>{$("#toast").hidden=true;},2400);}
function downloadJSON(object,filename){const url=URL.createObjectURL(new Blob([pretty(object)+"\n"],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$$("[data-source]").forEach(b=>b.addEventListener("click",()=>selectSource(b.dataset.source)));
$$("[data-stage]").forEach(b=>b.addEventListener("click",()=>setStage(b.dataset.stage)));
$("#ir-frame").addEventListener("input",()=>{frameIndex=Number($("#ir-frame").value);renderIR();});
["show-object","show-gripper","show-path","show-depth","show-contact"].forEach(id=>$("#"+id).addEventListener("change",renderIR));
$$("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;setActive("[data-filter]","filter",filter);const items=filteredItems();if(items.length&&!items.some(v=>v.i===selectedIndex)){selectedIndex=items[0].i;revealed=false;}renderTasks();}));
$("#family-search").addEventListener("input",renderFamilyList);
$("#reveal-answer").addEventListener("click",()=>{revealed=!revealed;renderTasks();});
$("#back-to-tasks").addEventListener("click",()=>setStage("tasks"));
$("#download-record").addEventListener("click",()=>downloadJSON(currentCase().records[selectedIndex],source+"-vqa-record.json"));
$("#copy-record").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(pretty(currentCase().records[selectedIndex]));toast("VQA record copied");}catch{toast("Copy unavailable. Use Download record instead.");}});

fetch("assets/demo-data.json").then(response=>{if(!response.ok)throw new Error("Episode data could not be loaded.");return response.json();}).then(data=>{
  episodes=data;
  selectSource("robocasa");
  const sample=data.find(c=>c.id==="robocasa").items.find(i=>i.metadata.family==="object_reference");
  $("#format-example").textContent=pretty({id:sample.id,images:sample.images,target:sample.target});
}).catch(error=>{console.error(error);$("#demo-error").hidden=false;$("#demo-error").textContent="The recorded demo could not be loaded. Please refresh the page. "+error.message;$("#episode-instruction").textContent="Episode data unavailable";});
