"use strict";
(() => {
  const el=id=>document.getElementById(id), esc=escapeHTML;
  let pendingSeek=null, resumeTimer=null, focusFrame=null;
  const introTimers=new Set();let introAnimations=[];
  let storySteps=null, storyIndex=0, storyWaiting=false;
  let wipe=50, mainVideo=null, secondaryVideo=null, raf=null, switching=false;
  const dense=(v)=>data.videoTracks?.[v.id]?.[time]||{};
  let data, time=0, evidence='object', itemIndex=0, depth=false, showTarget=false, guess=null, replay=null, tour=null;
  const kinds={object:{label:'Object',icon:'◉',description:'Visible object locations and grounded references.',test:f=>/object_reference|RoboRefIt|PIO\|S1|PixMo|present-absent/.test(f)},gripper:{label:'Gripper',icon:'⌘',description:'End-effector tracks and object–gripper configurations.',test:f=>/configuration|secure_grasp/.test(f)},contact:{label:'Contact',icon:'⊙',description:'Interaction locations and contact decisions.',test:f=>/PartAfford|PointBench\|affordable|RoboAfford\|object affordance|demonstrated_contact_affordance|relational_contact_placement|ContactDecide/.test(f)},motion:{label:'Motion',icon:'↝',description:'Ordered end-effector positions and task progression.',test:f=>/trajectory|future_prediction|planning|consequence/.test(f)},views:{label:'Cross-view',icon:'⊞',description:'Synchronized observations of the same robot execution.',test:f=>/multi_view/.test(f)},all:{label:'All evidence',icon:'◇',description:'All recorded task targets for this episode.',test:()=>true}};
  const views=()=>data.id==='robocasa'?[...data.views].reverse().slice(0,2):data.views.slice(0,2);
  const frame=(v)=>v.frames.reduce((a,b)=>Math.abs(a.index-time)<Math.abs(b.index-time)?a:b);
  const matches=()=>data.items.map((item,i)=>({item,i})).filter(({item})=>kinds[evidence].test(item.metadata.family));
  function stop(){el('episode-lab').dataset.interactive='false';closeQuestion();storySteps=null;storyWaiting=false;if(mainVideo)mainVideo.pause();if(secondaryVideo)secondaryVideo.pause();cancelAnimationFrame(raf);clearInterval(replay);clearInterval(tour);replay=null;tour=null;el('lab-play').textContent='▶';el('lab-tour').textContent='▶ Play interactive video';}
  function box(box,v,color){if(!box)return '';return `<rect x="${box[0]/v.width*1000}" y="${box[1]/v.height*1000}" width="${(box[2]-box[0])/v.width*1000}" height="${(box[3]-box[1])/v.height*1000}" fill="${color}15" stroke="${color}" stroke-width="3"/>`;}
  function point(p,color){return p?`<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="${color}" stroke="white" stroke-width="3"/>`:'';}
  function mountVideo(){
    const vs=views();
    el('lab-cameras').innerHTML=vs.map((v,n)=>`<div class="lab-camera ${n?'pip-camera':'main-camera'}"><video id="lab-video-${n}" src="${esc(data.base+v.video)}" poster="${esc(data.base+v.frames[0].image)}" preload="metadata" muted playsinline aria-label="${esc(v.label)}"></video><img class="depth-wipe" hidden alt="Recorded depth map"><i class="wipe-divider" hidden></i><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg><span class="camera-label">${v.label} <small></small></span>${n?'<span class="pip-caption">SYNCED VIEW</span>':''}</div>`).join('');
    el('lab-cameras').dataset.playing='false';el('lab-cameras').dataset.depth='false';pendingSeek=null;mainVideo=el('lab-video-0');secondaryVideo=el('lab-video-1');mainVideo.playbackRate=+el('lab-speed').value;const primary=mainVideo;const on=(event,handler)=>primary.addEventListener(event,(...args)=>{if(primary===mainVideo)handler(...args)});
    on('loadedmetadata',()=>{if(time>0)mainVideo.currentTime=time/vs[0].fps;paint()});
    on('timeupdate',syncFrame);
    on('seeked',syncFrame);
    on('play',()=>{el('lab-cameras').dataset.playing='true';depth=false;setLayers();el('lab-play').textContent='Ⅱ';if(secondaryVideo){secondaryVideo.currentTime=mainVideo.currentTime;secondaryVideo.playbackRate=mainVideo.playbackRate;secondaryVideo.play().catch(()=>{})}tick()});
    on('pause',()=>{el('lab-cameras').dataset.playing='false';secondaryVideo?.pause();el('lab-play').textContent='▶';cancelAnimationFrame(raf);syncFrame()});
    on('ended',()=>{secondaryVideo?.pause();el('lab-play').textContent='▶';cancelAnimationFrame(raf)});
    mainVideo.onclick=()=>mainVideo.paused?mainVideo.play().catch(()=>{}):mainVideo.pause();
    el('lab-cameras').querySelectorAll('.lab-camera').forEach(camera=>{camera.onpointermove=e=>{if(!depth||e.pointerType==='touch')return;const r=camera.getBoundingClientRect();wipe=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));el('lab-cameras').querySelectorAll('.depth-wipe').forEach(img=>img.style.clipPath=`inset(0 0 0 ${wipe}%)`);el('lab-cameras').querySelectorAll('.wipe-divider').forEach(div=>div.style.left=wipe+'%')}});
  }
  function setLayers(){el('lab-cameras').dataset.depth=String(depth);document.querySelectorAll('[data-layer]').forEach(b=>{const active=(b.dataset.layer==='depth')===depth;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});}
  function syncFrame(){if(!mainVideo||switching)return;if(pendingSeek!==null){if(mainVideo.seeking)return;pendingSeek=null;}time=Math.min(views()[0].frameCount-1,Math.floor(mainVideo.currentTime*views()[0].fps+.01));if(secondaryVideo&&Math.abs(secondaryVideo.currentTime-mainVideo.currentTime)>.07)secondaryVideo.currentTime=mainVideo.currentTime;paint();}
  function tick(){cancelAnimationFrame(raf);if(!mainVideo||mainVideo.paused)return;syncFrame();raf=requestAnimationFrame(tick);}
  function seekTo(index){if(!data)return;time=Math.max(0,Math.min(views()[0].frameCount-1,Math.round(index)));pendingSeek=time;const seconds=(time+.2)/views()[0].fps;if(mainVideo){mainVideo.currentTime=seconds;if(secondaryVideo)secondaryVideo.currentTime=seconds}paint();}
  function paint(){
    if(!data)return;
    const vs=views();el('lab-time').value=time;el('lab-time-label').textContent=`${(time/vs[0].fps).toFixed(2)}s · f ${time}`;
    vs.forEach((v,n)=>{const saved=frame(v),f={...dense(v)};const camera=el('lab-cameras').children[n];if(!camera)return;let shapes='';
      if(el('lab-tracks').checked){shapes+=box(f.objectBox,v,'#4a9eff')+box(f.gripperBox,v,'#3bdbb6')+point(f.gripperPoint,'#3bdbb6');if(evidence==='contact')shapes+=(f.contactPoints||[]).map(p=>point(p,'#ffc266')).join('');if(evidence==='motion'){const pts=(data.videoTracks?.[v.id]||[]).slice(Math.max(0,time-50),time+1).map(a=>a.gripperPoint||(a.gripperBox?[(a.gripperBox[0]+a.gripperBox[2])/v.width*500,(a.gripperBox[1]+a.gripperBox[3])/v.height*500]:null)).filter(Boolean);shapes+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#ffc266" stroke-width="5"/>`;}}
      camera.querySelector('svg').innerHTML=shapes;camera.querySelector('.camera-label small').textContent='f '+time;
      const map=camera.querySelector('.depth-wipe'),divider=camera.querySelector('.wipe-divider');map.hidden=!depth;divider.hidden=!depth;if(depth){map.src=data.base+saved.depthImage;map.style.clipPath=`inset(0 0 0 ${wipe}%)`;divider.style.left=wipe+'%';}
      camera.querySelectorAll('rect').forEach(r=>r.onclick=e=>{e.stopPropagation();mainVideo.pause();selectEvidence(r.getAttribute('stroke')==='#4a9eff'?'object':'gripper')});
    });
    const expanded=el('lab-evidence-detail').querySelector('details')?.open;
    const f=dense(vs[0]);el('lab-evidence-detail').innerHTML=`<span>${esc(kinds[evidence].label.toUpperCase())} · FRAME ${time}</span><p>${esc(kinds[evidence].description)}</p><details><summary>View frame data</summary><code>${esc(JSON.stringify(evidence==='contact'?{contact_frame:data.anchors.contact,points:f.contactPoints||[]}:evidence==='views'?{cameras:vs.map(v=>v.id)}:evidence==='motion'?{eef_point:f.gripperPoint||null}:{bbox_xyxy:evidence==='gripper'?f.gripperBox||null:f.objectBox||null}))}</code></details>`;
    if(expanded)el('lab-evidence-detail').querySelector('details').open=true;
    document.querySelectorAll('#lab-events button').forEach(b=>b.classList.toggle('at-event',Math.abs(+b.dataset.time-time)<3));
  }
  function nodes(){el('lab-nodes').innerHTML=Object.entries(kinds).filter(([k])=>k!=='all').map(([key,v],i)=>`<button class="evidence-node n${i} ${evidence===key?'selected':''}" data-evidence="${key}" aria-pressed="${evidence===key}"><span>${v.icon}</span>${v.label}<small>${data.items.filter(item=>v.test(item.metadata.family)).length} tasks</small></button>`).join('');el('lab-nodes').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop();selectEvidence(b.dataset.evidence)});}
  function selectEvidence(kind){evidence=kind;showTarget=false;guess=null;const m=matches();const contextDistance=item=>Math.min(...item.images.map(path=>{const match=path.match(/(?:frame_)?(\d+)\.(?:jpg|png)$/);return match?Math.abs(+match[1]-time):Infinity}));if(m.length)itemIndex=m.reduce((best,next)=>contextDistance(next.item)<contextDistance(best.item)?next:best).i;nodes();families();paint();task();el('lab-narration').textContent=`${kinds[kind].label} → ${m.length} recorded tasks. Change the task family to explore a different supervision target.`;}
  function families(){const m=matches();el('lab-count').textContent=m.length+' records';el('lab-family').innerHTML=m.map(({item,i})=>`<option value="${i}">${esc(taskName(item))}</option>`).join('');el('lab-family').value=itemIndex;}
  function task(){
    const item=data.items[itemIndex];showTarget=!!showTarget;
    el('lab-context').classList.toggle('one',item.images.length===1);
    el('lab-context').innerHTML=item.images.map((path,i)=>`<div class="lab-input" data-image="${i}"><img src="${esc(data.base+path)}" alt="Recorded question input ${i+1}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none">${showTarget&&item.images.length===1?targetOverlay(item.target):''}${guess?.point&&item.images.length===1?point(guess.point,'#e779ab'):''}</svg><span>INPUT ${i+1}</span></div>`).join('');
    const question=item.question.split('\n')[0].split(/\s+Return only/)[0];el('lab-question').textContent=question;
    const opts=[...item.question.matchAll(/^\(([A-Z])\) (.+)$/gm)];
    el('lab-options').innerHTML=opts.map(m=>`<button data-option="${m[1]}" class="${guess?.label===m[1]?'chosen':''} ${showTarget&&item.target.correct_label===m[1]?'answer-option':''}"><b>${m[1]}</b>${esc(m[2])}${showTarget&&item.target.correct_label===m[1]?'<span>Target</span>':''}</button>`).join('');
    el('lab-options').querySelectorAll('button').forEach(b=>b.onclick=()=>{guess={label:b.dataset.option};task()});
    if(item.target.type==='point'&&item.images.length===1){el('lab-context').querySelector('.lab-input').classList.add('pointable');el('lab-context').querySelector('.lab-input').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();guess={point:[Math.round((e.clientX-r.left)/r.width*1000),Math.round((e.clientY-r.top)/r.height*1000)]};task()};}
    el('lab-reveal').textContent=showTarget?'Hide target':'Reveal target ↗';el('lab-answer').hidden=!showTarget;el('lab-answer').innerHTML=`<span>TYPED TARGET · ${esc(item.target.type)}</span><pre>${esc(answerValue(item.target))}</pre>`;
    el('lab-task-hint').textContent=item.target.type==='point'?'Click the input image to place your point, then reveal the stored target.':item.target.type==='choice'?'Choose an option, then reveal the stored target.':'Reveal the ordered trajectory or presence target from the recorded output.';
  }
  function load(c){switching=true;stop();data=c;time=0;evidence='object';itemIndex=c.items.findIndex(i=>i.metadata.family==='object_reference');depth=false;showTarget=false;guess=null;el('lab-time').max=views()[0].frameCount-1;mountVideo();switching=false;el('lab-events').innerHTML=Object.entries(c.anchors).map(([k,v])=>`<button data-time="${v}"><i></i>${k}<small>${v}</small></button>`).join('');el('lab-events').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop();seekTo(+b.dataset.time);selectEvidence(b.textContent.includes('contact')?'contact':b.textContent.includes('grasp')?'gripper':b.textContent.includes('final')||b.textContent.includes('placed')?'motion':'object')});selectEvidence('object');
    document.querySelectorAll('[data-layer]').forEach(b=>{b.classList.toggle('active',b.dataset.layer==='rgb');b.setAttribute('aria-pressed',String(b.dataset.layer==='rgb'));});
    const v=views()[0];el('hero-visual').innerHTML=`<div class="hero-orbit"></div><div class="hero-frame back"><img src="${esc(c.base+frame(views()[1]).image)}" alt="Second camera view of the demo episode"><span>SYNCHRONIZED VIEW</span></div><div class="hero-frame front"><img src="${esc(c.base+v.frames[0].image)}" alt="Primary view of the demo episode"><span>RAW EPISODE <i>→</i> EMBODIED SUPERVISION</span></div><div class="hero-chip"><i></i> One episode. Many targets.</div>`;
  }
  el('lab-time').oninput=()=>{const target=+el('lab-time').value;stop();depth=false;setLayers();seekTo(target)};
  el('lab-tracks').onchange=paint;
  document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{if(!data)return;stop();depth=b.dataset.layer==='depth';if(depth)seekTo(frame(views()[0]).index);setLayers();paint()});
  el('lab-family').onchange=()=>{itemIndex=+el('lab-family').value;showTarget=false;guess=null;task()};
  el('lab-all').onclick=()=>{if(!data)return;stop();selectEvidence('all')};
  el('lab-reveal').onclick=()=>{showTarget=!showTarget;task()};
  el('lab-inspect').onclick=()=>{selectedIndex=itemIndex;document.querySelector('.artifact-browser').open=true;setStage('vqa');document.getElementById('vqa-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})};
  el('lab-play').onclick=()=>{if(!mainVideo)return;if(mainVideo.paused){stop();mainVideo.play().catch(()=>{})}else stop()};
  function checkpoint(){
    const step=storySteps[storyIndex];storyWaiting=true;mainVideo.pause();secondaryVideo?.pause();seekTo(step.frame);selectEvidence(step.kind);itemIndex=step.item;showTarget=false;guess=null;families();task();openQuestion();
    el('lab-tour').textContent='■ Exit interactive video';
    focusWorkbench();
  }
  function closeQuestion(){
    cancelAnimationFrame(focusFrame);
    el('video-question')?.querySelector('.vq-zoom-dialog')?.close();
    clearQuestionIntro();
    clearTimeout(resumeTimer);resumeTimer=null;
    el('video-question')?.remove();
    el('video-guide')?.remove();
    el('lab-cameras').classList.remove('answering');
  }
  function guideRobot(){
    const drawing=document.querySelector('.robot-guide svg').cloneNode(true);
    drawing.querySelectorAll('[id]').forEach(node=>{const id=node.id;node.id='video-'+id;drawing.querySelectorAll(`[fill="url(#${id})"]`).forEach(shape=>shape.setAttribute('fill',`url(#video-${id})`))});
    return drawing.outerHTML;
  }
  function playbackGuide(){
    const guide=document.createElement('div');guide.id='video-guide';guide.className='video-guide';
    guide.innerHTML=`<img src="assets/robot-guide.svg" alt=""><span>Keep watching…<small>I'll pause at the next question.</small></span>`;
    el('lab-cameras').after(guide);
  }
  function questionText(item){
    const family=item.metadata.family;
    if(item.target.type==='traj2d')return data.id==='robocasa'?'Trace the gripper’s next short movement in Input 1.':'Trace the demonstrated gripper path in Input 1.';
    if(family==='object_reference')return data.id==='robocasa'?'Where is the chicken drumstick?':'Where is the lid?';
    if(family==='demonstrated_contact_affordance')return data.id==='robocasa'?'Where does the gripper interact with the chicken drumstick?':'Where does the gripper interact with the lid?';
    if(family==='Success_Task')return data.id==='robocasa'?'Did the robot place the chicken drumstick in the pan?':'Did the robot uncover the cooker and put the lid in the sink?';
    return item.question.split('\n')[0].split(/\s+Return only/)[0];
  }
  function answerEvidence(item){
    const family=item.metadata.family,sim=data.id==='robocasa';
    if(item.target.type==='traj2d')return sim?'IR support: projected end-effector positions define the ordered target path.':'IR support: tracked gripper centers define the ordered target path.';
    if(family==='object_reference')return 'IR support: the object bounds ground the recorded pointing target in this frame.';
    if(family==='demonstrated_contact_affordance')return sim?'IR support: the projected simulator contact locates the interaction target.':'IR support: the overlap of object and gripper boxes defines this interaction target.';
    if(family==='multi_view_task_consistency')return sim?'IR support: synchronized views share the object identity and contact state.':'IR support: matching episode and frame identifiers link these camera views.';
    return sim?'IR support: object–container contact and released fingers support the recorded placement answer.':'IR support: the saved VLM annotation of the initial and final observations supplies the recorded answer.';
  }
  function questionContext(path){
    const view=data.views.find(v=>path.split('/')[1]===v.id),index=inputFrame(path);
    if(!view)return null;
    const saved=view.frames.find(f=>f.image===path)||{};
    return {view,index,frame:{...(data.videoTracks?.[view.id]?.[index]||{}),...saved}};
  }
  function trajectoryIR(item,view){
    const evidence=item.metadata.evidence||{};
    const indices=evidence.state_indices||evidence.sample_indices||[];
    return indices.map(index=>data.videoTracks?.[view.id]?.[index]).filter(Boolean).map(f=>f.gripperPoint||(f.gripperBox?[(f.gripperBox[0]+f.gripperBox[2])/view.width*500,(f.gripperBox[1]+f.gripperBox[3])/view.height*500]:null)).filter(Boolean);
  }
  function questionIR(item){
    const family=item.metadata.family,sim=data.id==='robocasa';
    const layers={object:{key:'object',label:'Object bounds',color:'#3674df'},gripper:{key:'gripper',label:sim?'End-effector':'Gripper bounds',color:'#168d76'},contact:{key:'contact',label:sim?'Physical contact':'Overlap center',color:'#ce7621'},trajectory:{key:'trajectory',label:'Gripper trajectory',color:'#7755c3'},sync:{key:'sync',label:'Synchronized views',color:'#3674df'},phase:{key:'phase',label:'Contact & release',color:'#168d76'},semantics:{key:'semantics',label:'Visual semantics',color:'#3674df'}};
    let keys,explanation;
    if(item.target.type==='traj2d'){
      keys=['gripper','trajectory'];explanation=sim?'Calibrated end-effector positions → projected motion → trajectory waypoints.':'Tracked gripper centers → ordered motion → interpolated trajectory waypoints.';
    }else if(family==='object_reference'){
      keys=['object'];explanation=sim?'Rendered object-instance IR → visible object location → pointing question.':'VLM object grounding + SAM3 localization → visible object location → pointing question.';
    }else if(family==='demonstrated_contact_affordance'){
      keys=sim?['object','contact']:['object','gripper','contact'];explanation=sim?'Physical contact in simulator state → camera projection → interaction-point question.':'Object and gripper boxes → overlap center → interaction-point question.';
    }else if(family==='multi_view_task_consistency'){
      keys=sim?['object','contact','sync']:['sync'];explanation=sim?'Shared object identity + contact state across synchronized views → cross-view consistency question.':'Shared episode identity + matching source-frame indices → cross-view consistency question.';
    }else{
      keys=sim?['phase']:['semantics'];explanation=sim?'Object–container contact + released fingers → demonstrated placement state → success question.':'Initial and final observations → saved VLM semantic annotation → success question.';
    }
    return {layers:keys.map(key=>layers[key]),explanation};
  }
  function irPanel(item,info){
    return `<section class="vq-ir-panel" aria-label="How this question is constructed"><div class="vq-ir-toolbar"><div class="vq-ir-mode" role="group" aria-label="Frame display"><button data-ir-mode="raw" aria-pressed="true">Raw</button><button data-ir-mode="ir" aria-pressed="false">Show IR</button></div><div class="vq-ir-layers" role="group" aria-label="IR layers for this question">${info.layers.map(l=>`<button data-ir-layer="${l.key}" aria-pressed="true"><i style="background:${l.color}"></i>${esc(l.label)}</button>`).join('')}</div></div><p class="vq-ir-explanation">${esc(info.explanation)}</p><div class="vq-ir-facts" hidden></div></section>`;
  }
  function renderQuestionImages(overlay,item){
    const visible=overlay.dataset.irMode==='ir';
    overlay.querySelectorAll('.vq-image').forEach((image,n)=>{
      const context=questionContext(item.images[n]);let shapes='';
      if(visible&&context){
        const {frame:f,view:v,index}=context;
        const active=key=>overlay.querySelector(`[data-ir-layer="${key}"]`)?.getAttribute('aria-pressed')==='true';
        if(active('object'))shapes+=box(f.objectBox,v,'#3674df');
        if(active('gripper'))shapes+=box(f.gripperBox,v,'#168d76')+point(f.gripperPoint,'#168d76');
        if(active('contact')){
          let contacts=f.contactPoints||[];
          if(data.id==='droid'&&f.objectBox&&f.gripperBox){
            const a=f.objectBox,b=f.gripperBox,x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]),x2=Math.min(a[2],b[2]),y2=Math.min(a[3],b[3]);
            if(x2>=x1&&y2>=y1)contacts=[[(x1+x2)/v.width*500,(y1+y2)/v.height*500]];
          }
          shapes+=contacts.map(p=>point(p,'#ce7621')).join('');
        }
        if(active('trajectory')){
          const pts=trajectoryIR(item,v);
          if(pts.length>1)shapes+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#7755c3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`+point(pts[0],'#7755c3')+point(pts[pts.length-1],'#7755c3');
        }
        image.dataset.linked=String(active('sync'));
        image.querySelector('.vq-input-label').textContent=`INPUT ${n+1} · ${v.label} · f ${index}${active('sync')?' · SYNCED':''}`;
      }else{
        image.dataset.linked='false';image.querySelector('.vq-input-label').textContent=`INPUT ${n+1} · f ${inputFrame(item.images[n])}`;
      }
      let answer='';
      if(n===0){
        if(guess?.point)answer+=point(guess.point,'#e779ab');
        if(guess?.traj)answer+=pathSVG(guess.traj,'#e779ab');
        if(showTarget&&(item.target.type==='point'||item.target.type==='traj2d'))answer+=targetOverlay(item.target);
      }
      image.querySelector('svg').innerHTML=`<g class="vq-ir-shapes">${shapes}</g><g class="vq-response">${answer}</g>`;
    });
    const facts=overlay.querySelector('.vq-ir-facts');
    const active=key=>visible&&overlay.querySelector(`[data-ir-layer="${key}"]`)?.getAttribute('aria-pressed')==='true';
    facts.hidden=!active('phase')&&!active('semantics');
    if(active('phase')){
      const evidence=item.metadata.evidence||{};
      facts.textContent=`Frame ${evidence.frame} · ${evidence.contacts.length} stored object–container contacts · finger contact: ${evidence.finger_contact.map(c=>c?'yes':'no').join(' / ')}`;
    }else if(active('semantics'))facts.textContent='Question source: saved visual-semantic annotation of the first and final observations.';
  }

  function clearQuestionIntro(){
    introTimers.forEach(clearTimeout);introTimers.clear();
    introAnimations.forEach(animation=>animation.cancel());introAnimations=[];
  }
  function sequenceBanner(){
    return `<div class="vq-sequence"><div class="vq-sequence-steps" aria-label="Question construction"><span data-phase="raw"><b>01</b> Raw episode</span><i aria-hidden="true">→</i><span data-phase="ir"><b>02</b> Episode IR</span><i aria-hidden="true">→</i><span data-phase="question"><b>03</b> VQA</span></div><div class="vq-sequence-controls"><span class="vq-sequence-status" role="status">Loading source frames…</span><button class="vq-skip-intro">Skip animation ↗</button></div></div>`;
  }
  function animateQuestionIR(overlay){
    let duration=950;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced)return 700;
    overlay.querySelectorAll('.vq-ir-shapes').forEach(group=>{
      [...group.children].forEach((shape,index)=>{
        const circle=shape.tagName.toLowerCase()==='circle';
        const delay=(circle?600:shape.tagName.toLowerCase()==='polyline'?350:0)+index*65;
        let keyframes;
        if(circle){
          shape.style.transformBox='fill-box';shape.style.transformOrigin='center';
          keyframes=[{opacity:0,transform:'scale(.25)'},{opacity:1,transform:'scale(1)'}];
        }else{
          const length=shape.getTotalLength();
          keyframes=[{opacity:1,strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{opacity:1,strokeDasharray:`${length} ${length}`,strokeDashoffset:0}];
        }
        const animation=shape.animate(keyframes,{duration:circle?400:800,delay,fill:'both',easing:'ease-in-out'});
        introAnimations.push(animation);duration=Math.max(duration,delay+(circle?400:800)+200);
      });
    });
    overlay.querySelectorAll('.vq-ir-facts:not([hidden]),.vq-image[data-linked=true] .vq-input-label').forEach(node=>{
      introAnimations.push(node.animate([{opacity:0},{opacity:1}],{duration:650,fill:'both'}));
    });
    return duration;
  }
  function startQuestionSequence(overlay,item){
    const stages=['raw','ir','question'];
    const labels={raw:'Original episode observation',ir:'Drawing the recorded episode evidence…',question:'Evidence → question. Your turn.'};
    function setStage(stage){
      overlay.dataset.stage=stage;
      overlay.querySelector('.vq-sequence-status').textContent=labels[stage];
      overlay.querySelectorAll('[data-phase]').forEach(node=>{
        const current=node.dataset.phase===stage;
        node.classList.toggle('complete',stages.indexOf(node.dataset.phase)<stages.indexOf(stage));
        if(current)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      });
      overlay.querySelectorAll('[data-ir-mode],[data-ir-layer],.vq-enlarge,.vq-zoom-select').forEach(button=>button.disabled=stage!=='question');
      overlay.querySelector('.vq-skip-intro').hidden=stage==='question';
      overlay.querySelector('.vq-guide').inert=stage!=='question';
      overlay.querySelector('.vq-options').inert=stage!=='question';
      overlay.querySelector('footer').inert=stage!=='question';
      el('lab-narration').textContent=`Checkpoint ${storyIndex+1} / ${storySteps.length} · ${labels[stage]}`;
    }
    function later(callback,delay){
      const timer=setTimeout(()=>{introTimers.delete(timer);if(overlay.isConnected&&storySteps)callback()},delay);
      introTimers.add(timer);
    }
    function showQuestion(){
      overlay.dataset.irMode='ir';renderQuestionImages(overlay,item);
      overlay.querySelectorAll('[data-ir-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.irMode==='ir')));
      setStage('question');
    }
    overlay.querySelector('.vq-skip-intro').onclick=()=>{clearQuestionIntro();showQuestion()};
    setStage('raw');
    Promise.all([...overlay.querySelectorAll('.vq-image img')].map(img=>img.decode().catch(()=>{}))).then(()=>{
      if(!overlay.isConnected||!storySteps||overlay.dataset.stage!=='raw')return;
      later(()=>{
        overlay.dataset.irMode='ir';renderQuestionImages(overlay,item);
        overlay.querySelectorAll('[data-ir-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.irMode==='ir')));
        setStage('ir');
        later(showQuestion,animateQuestionIR(overlay));
      },900);
    });
  }

  function focusWorkbench(){
    cancelAnimationFrame(focusFrame);
    focusFrame=requestAnimationFrame(()=>{
      const target=el('lab-cameras');
      const offset=document.querySelector('.header').getBoundingClientRect().height+12;
      window.scrollTo({top:Math.max(0,scrollY+target.getBoundingClientRect().top-offset),behavior:'instant'});
    });
  }
  function openImageZoom(overlay,item,index,selectPoint){
    const existing=overlay.querySelector('.vq-zoom-dialog');
    if(existing)return;
    const dialog=document.createElement('dialog');dialog.className='vq-zoom-dialog';
    const editable=index===0&&['point','traj2d'].includes(item.target.type)&&!showTarget;
    dialog.innerHTML=`<div class="vq-zoom-toolbar"><strong>Input ${index+1}</strong><div><button class="vq-zoom-out" aria-label="Zoom out">−</button><output>200%</output><button class="vq-zoom-in" aria-label="Zoom in">+</button><button class="vq-zoom-close">Done</button></div></div><p>${editable?'Drag to pan; tap the image to place or adjust your answer.':'Drag to pan. Your answer and the recorded evidence stay visible.'}</p><div class="vq-zoom-scroll"><div class="vq-zoom-image ${editable?'pointable':''}" data-index="${index}"><img src="${esc(data.base+item.images[index])}" alt="Enlarged question input ${index+1}" draggable="false"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg></div></div>`;
    overlay.append(dialog);
    const image=dialog.querySelector('.vq-zoom-image'),viewport=dialog.querySelector('.vq-zoom-scroll');
    let scale=2,pan=null,suppressTap=false;
    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button===0){pan={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};suppressTap=false}
    });
    viewport.addEventListener('pointermove',event=>{
      if(!pan)return;
      const dx=event.clientX-pan.x,dy=event.clientY-pan.y;
      if(Math.hypot(dx,dy)>5){suppressTap=true;viewport.setPointerCapture(event.pointerId);viewport.scrollLeft=pan.left-dx;viewport.scrollTop=pan.top-dy}
    });
    viewport.addEventListener('pointerup',()=>{pan=null});
    viewport.addEventListener('pointercancel',()=>{pan=null});
    function sync(){
      const original=overlay.querySelectorAll('.vq-image')[index];
      image.querySelector('svg').innerHTML=original.querySelector('svg').innerHTML;
    }
    function zoom(next){
      const centerX=(viewport.scrollLeft+viewport.clientWidth/2)/(viewport.scrollWidth||1);
      const centerY=(viewport.scrollTop+viewport.clientHeight/2)/(viewport.scrollHeight||1);
      scale=Math.max(1,Math.min(4,next));image.style.width=viewport.clientWidth*scale+'px';
      dialog.querySelector('output').textContent=Math.round(scale*100)+'%';
      viewport.scrollLeft=centerX*viewport.scrollWidth-viewport.clientWidth/2;
      viewport.scrollTop=centerY*viewport.scrollHeight-viewport.clientHeight/2;
      dialog.querySelector('.vq-zoom-out').disabled=scale===1;dialog.querySelector('.vq-zoom-in').disabled=scale===4;
    }
    dialog.querySelector('.vq-zoom-close').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.querySelector('.vq-zoom-in').onclick=()=>zoom(scale+.5);
    dialog.querySelector('.vq-zoom-out').onclick=()=>zoom(scale-.5);
    if(editable)image.onclick=event=>{
      if(suppressTap){suppressTap=false;return}
      const r=image.getBoundingClientRect();
      selectPoint([Math.round((event.clientX-r.left)/r.width*1000),Math.round((event.clientY-r.top)/r.height*1000)]);
      sync();
    };
    dialog.showModal();sync();zoom(2);
  }

  function openQuestion(){
    closeQuestion();
    const item=data.items[itemIndex], info=questionIR(item), trajectory=item.target.type==='traj2d', options=[...item.question.matchAll(/^\(([A-Z])\) (.+)$/gm)];
    const overlay=document.createElement('section');
    overlay.id='video-question';overlay.className='video-question '+(item.target.type==='point'?'vq-point':'vq-choice');overlay.setAttribute('aria-label','Video question');overlay.dataset.mood='asking';overlay.dataset.irMode='raw';overlay.dataset.stage='raw';overlay.style.setProperty('--input-rows',Math.ceil(item.images.length/2));
    overlay.innerHTML=`<header><span><i></i> PAUSED · QUESTION ${storyIndex+1} / ${storySteps.length}</span><button class="vq-exit" aria-label="Exit interactive video">×</button></header>${sequenceBanner()}<div class="vq-media"><div class="vq-media-tools"><span>Recorded inputs</span><div>${item.images.length>1?`<select class="vq-zoom-select" aria-label="Input to enlarge">${item.images.map((_,i)=>`<option value="${i}">Input ${i+1}</option>`).join('')}</select>`:''}<button class="vq-enlarge">⤢ Enlarge</button></div></div><div class="vq-visuals ${item.images.length===1?'single':''}">${item.images.map((path,i)=>`<div class="vq-image ${i===0&&(item.target.type==='point'||trajectory)?'pointable':''}"><img src="${esc(data.base+path)}" alt="Question input ${i+1}"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg><span class="vq-input-label">INPUT ${i+1} · f ${inputFrame(path)}</span></div>`).join('')}</div></div>${irPanel(item,info)}<div class="vq-awaiting"><span>RAW → IR → VQA</span><p>Follow the evidence.<br>The robot will ask its question next.</p></div><div class="vq-card"><div class="vq-prompt"><div class="vq-guide"><div class="vq-avatar">${guideRobot()}<span class="vq-emotion" aria-hidden="true">?</span></div><div class="vq-speech"><span class="vq-guide-label">${trajectory?"Let’s follow the motion":item.target.type==='point'?"Let's look closely":"What do you notice?"}</span><h3>${esc(questionText(item))}</h3><p class="vq-instruction">${trajectory?`Sketch 2+ ordered waypoints in Input 1. The original target has ${item.target.traj.length} points; this demo accepts a shorter sketch. Use Undo point to adjust.`:item.target.type==='point'?'Click the target in the frame, then Submit answer. Click again to adjust.':'Choose an option using the input frames, then press Submit answer.'}</p><details class="vq-original"><summary>Original dataset question</summary><p>${esc(item.question)}</p></details><div class="vq-feedback" role="status" hidden></div></div></div><div class="vq-options">${options.map(m=>`<button data-choice="${m[1]}"><b>${m[1]}</b> ${esc(m[2])}</button>`).join('')}</div></div><footer><span class="vq-status">${trajectory?'Click waypoints in order':item.target.type==='point'?'Click to place your answer':'Choose one option'}</span>${trajectory?'<button class="vq-undo" disabled>Undo point</button>':''}<button class="lab-btn vq-submit" disabled>Submit answer</button><button class="vq-hold-feedback" hidden>Hold feedback</button><button class="lab-btn vq-resume-feedback" hidden>Continue video →</button><span class="vq-countdown" hidden><span>Continuing in 2.5 seconds…</span><i aria-hidden="true"></i></span></footer></div>`;
    el('lab-cameras').append(overlay);el('lab-cameras').classList.add('answering');
    renderQuestionImages(overlay,item);
    overlay.querySelector('.vq-exit').onclick=stop;
    overlay.querySelectorAll('[data-ir-mode]').forEach(button=>button.onclick=()=>{
      overlay.dataset.irMode=button.dataset.irMode;
      overlay.querySelectorAll('[data-ir-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      renderQuestionImages(overlay,item);
    });
    overlay.querySelectorAll('[data-ir-layer]').forEach(button=>button.onclick=()=>{
      button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
      renderQuestionImages(overlay,item);
    });
    overlay.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{
      if(showTarget||overlay.dataset.stage!=='question')return;guess={label:button.dataset.choice};
      overlay.querySelectorAll('[data-choice]').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button))});
      overlay.querySelector('.vq-submit').disabled=false;overlay.querySelector('.vq-status').textContent='Answer selected';task();
    });
    function selectPoint(selected){
      if(showTarget||overlay.dataset.stage!=='question')return;
      selected=selected.map(value=>Math.max(0,Math.min(1000,value)));
      guess=trajectory?{traj:[...(guess?.traj||[]),selected]}:{point:selected};
      renderQuestionImages(overlay,item);
      overlay.querySelector('.vq-submit').disabled=trajectory&&guess.traj.length<2;
      if(trajectory)overlay.querySelector('.vq-undo').disabled=false;
      overlay.querySelector('.vq-status').textContent=trajectory?`${guess.traj.length} waypoints placed`:'Point placed · click to adjust';task();
    }
    if(item.target.type==='point'||trajectory)overlay.querySelector('.vq-image').onclick=event=>{
      const r=event.currentTarget.getBoundingClientRect();
      selectPoint([Math.round((event.clientX-r.left)/r.width*1000),Math.round((event.clientY-r.top)/r.height*1000)]);
    };
    function holdFeedback(){
      if(!showTarget)return;
      clearTimeout(resumeTimer);resumeTimer=null;overlay.dataset.feedbackHeld='true';
      overlay.querySelector('.vq-countdown').hidden=true;
      overlay.querySelector('.vq-hold-feedback').hidden=true;
      overlay.querySelector('.vq-resume-feedback').hidden=false;
      overlay.querySelector('.vq-status').textContent='Feedback paused · continue when ready.';
    }
    overlay.querySelector('.vq-hold-feedback').onclick=holdFeedback;
    overlay.querySelector('.vq-resume-feedback').onclick=()=>{if(storySteps&&overlay.isConnected)advanceStory()};
    overlay.querySelector('.vq-enlarge').onclick=()=>{
      if(overlay.dataset.stage!=='question')return;
      if(showTarget)holdFeedback();
      openImageZoom(overlay,item,+(overlay.querySelector('.vq-zoom-select')?.value||0),selectPoint);
    };
    if(trajectory)overlay.querySelector('.vq-undo').onclick=()=>{
      if(showTarget)return;guess.traj.pop();renderQuestionImages(overlay,item);
      overlay.querySelector('.vq-submit').disabled=guess.traj.length<2;overlay.querySelector('.vq-undo').disabled=!guess.traj.length;
      overlay.querySelector('.vq-status').textContent=`${guess.traj.length} waypoints placed`;
    };
    overlay.querySelector('.vq-submit').onclick=()=>{
      if(!guess||overlay.dataset.stage!=='question')return;showTarget=true;task();
      renderQuestionImages(overlay,item);
      if(trajectory)overlay.querySelector('.vq-undo').hidden=true;
      overlay.querySelectorAll('[data-choice]').forEach(b=>{b.disabled=true;b.classList.toggle('target',b.dataset.choice===item.target.correct_label)});
      const feedback=overlay.querySelector('.vq-feedback');feedback.hidden=false;
      const matched=item.target.type==='choice'&&guess.label===item.target.correct_label;
      overlay.dataset.mood=item.target.type!=='choice'?'compare':matched?'happy':'reflect';
      overlay.querySelector('.vq-guide-label').textContent=trajectory?"Let's compare the paths":item.target.type==='point'?"Let's compare our points":matched?'Nice observation!':"Let's take another look";
      overlay.querySelector('.vq-emotion').textContent=matched?'✓':item.target.type==='point'?'◎':'↗';
      overlay.querySelector('.vq-instruction').hidden=true;
      feedback.textContent=item.target.type==='choice'?(matched?"That matches the recorded answer. Let's keep watching.":`The recorded answer is ${item.target.correct_label}, highlighted below.`):trajectory?"Your path is pink; the stored trajectory target is gold.":"Your point is pink; the recorded target is blue.";
      const support=document.createElement('span');support.className='vq-feedback-evidence';support.textContent=answerEvidence(item);feedback.append(support);
      overlay.querySelector('.vq-submit').hidden=true;overlay.querySelector('.vq-countdown').hidden=false;overlay.querySelector('.vq-status').textContent='Answer submitted';
      overlay.querySelector('.vq-hold-feedback').hidden=false;overlay.querySelector('.vq-hold-feedback').focus({preventScroll:true});
      resumeTimer=setTimeout(()=>{if(storySteps&&overlay.isConnected)advanceStory()},2500);
    };
    startQuestionSequence(overlay,item);
  }
  function advanceStory(){
    closeQuestion();storyIndex++;storyWaiting=false;
    if(storyIndex>=storySteps.length){stop();el('lab-narration').textContent='Episode complete · Explore more question families or replay the interactive video.';el('lab-tour').textContent='↻ Replay interactive video';focusWorkbench();return;}
    if(storySteps[storyIndex].frame<=time){checkpoint();return;}
    playbackGuide();mainVideo.play().catch(()=>{});focusWorkbench();
  }
  function inputFrame(path){return +(path.match(/(?:frame_)?(\d+)\.(?:jpg|png)$/)?.[1]||0)}
  el('lab-tour').onclick=()=>{
    if(!data||!mainVideo)return;
    if(storySteps){stop();return;}
    stop();depth=false;setLayers();
    const families=['object_reference','demonstrated_contact_affordance','multi_view_task_consistency','continuous_trajectory_eval_format/sharerobot_trajectory_variable_point_format','Success_Task'];
    storySteps=families.map(family=>{
      const item=data.items.findIndex(i=>i.metadata.family===family),record=data.items[item];
      const indices=record.metadata.evidence?.state_indices||[];
      return {item,frame:Math.max(...record.images.map(inputFrame),...indices),kind:record.target.type==='traj2d'?'motion':family==='object_reference'?'object':family==='demonstrated_contact_affordance'?'contact':family==='Success_Task'?'motion':'views'};
    }).sort((a,b)=>a.frame-b.frame);
    el('episode-lab').dataset.interactive='true';
    storyIndex=0;checkpoint();
    tour=setInterval(()=>{if(storySteps&&!storyWaiting&&time>=storySteps[storyIndex].frame)checkpoint()},40);
  };
  window.addEventListener('episodefocusrequest',focusWorkbench);
  document.querySelector('.demo-invitation a').addEventListener('click',event=>{
    event.preventDefault();
    if(storySteps)focusWorkbench();else el('lab-tour').click();
  });
  el('lab-speed').onchange=()=>{if(mainVideo){mainVideo.playbackRate=+el('lab-speed').value;if(secondaryVideo)secondaryVideo.playbackRate=mainVideo.playbackRate}};
  el('lab-prev').onclick=()=>{const target=time-1;stop();depth=false;setLayers();seekTo(target)};el('lab-next').onclick=()=>{const target=time+1;stop();depth=false;setLayers();seekTo(target)};
  el('lab-fullscreen').onclick=()=>el('lab-cameras').requestFullscreen?.().catch(()=>{});
  document.addEventListener('fullscreenchange',()=>{if(mainVideo)mainVideo.controls=!!document.fullscreenElement});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
  window.addEventListener('episodechange',event=>load(event.detail));
  if(typeof episodes!=='undefined'&&episodes.length)load(currentCase());
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.section-top,.insights article,.method-flow,.protocol').forEach(node=>{node.classList.add('reveal-in');observer.observe(node)});
})();
