'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {AudioLines,Play,Pause,Upload,Plus,Trash2,Download,ZoomIn,ZoomOut,RotateCcw,FileJson,FileSpreadsheet,CheckCircle2,AlertTriangle} from 'lucide-react';
import {prepareAudioUpload} from '../lib/audio';
import {Annotation,LabelKind,Prediction,LABELS,LABEL_NAMES,LABEL_COLORS,PREDICTION_NAMES,evaluateAnnotations,importedAnnotations,makeManifest,toCsv,validAnnotation} from '../lib/annotation';

const WIDTH=1000,LEFT=43,RIGHT=985,TOP=18,BOTTOM=180;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const format=(n:number)=>n.toFixed(2)+'s';
function saveFile(name:string,text:string,mime:string){
 const link=document.createElement('a');
 const url=URL.createObjectURL(new Blob([text],{type:mime}));
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function scoreText(n:number|null){return n===null?'—':(100*n).toFixed(1)+'%'}
const cleanFilename=(name:string)=>name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,70)||'guitar';

export function AnnotationStudio(){
 const [file,setFile]=useState<File|null>(null);
 const [url,setUrl]=useState('');
 const [duration,setDuration]=useState(0);
 const [peaks,setPeaks]=useState<number[]>([]);
 const [playing,setPlaying]=useState(false);
 const [time,setTime]=useState(0);
 const [zoom,setZoom]=useState(1);
 const [startView,setStartView]=useState(0);
 const [selection,setSelection]=useState<{start:number;end:number}|null>(null);
 const [dragStart,setDragStart]=useState<number|null>(null);
 const [annotations,setAnnotations]=useState<Annotation[]>([]);
 const [kind,setKind]=useState<LabelKind>('bend');
 const [selected,setSelected]=useState<string|null>(null);
 const [predictions,setPredictions]=useState<Prediction[]>([]);
 const [predictionState,setPredictionState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [predictionError,setPredictionError]=useState('');
 const [showPredictions,setShowPredictions]=useState(true);
 const [sessionId,setSessionId]=useState('session-001');
 const [message,setMessage]=useState('');
 const [threshold,setThreshold]=useState(.3);
 const audio=useRef<HTMLAudioElement|null>(null);
 const selectFile=useRef<HTMLInputElement|null>(null);
 const importInput=useRef<HTMLInputElement|null>(null);
 const objectURL=useRef<string>('');
 useEffect(()=>()=>{if(objectURL.current)URL.revokeObjectURL(objectURL.current)},[]);
 const visibleLength=duration/zoom;
 const viewEnd=Math.min(duration,startView+visibleLength);
 const project=(t:number)=>LEFT+(t-startView)/Math.max(.001,visibleLength)*(RIGHT-LEFT);
 const within=(t:number)=>t>=startView&&t<=viewEnd;
 const matches=useMemo(()=>predictionState==='ready'?evaluateAnnotations(annotations,predictions,threshold):null,[annotations,predictions,threshold,predictionState]);
 const picked=annotations.find(a=>a.id===selected)||null;
 const [formStart,setFormStart]=useState('0');
 const [formEnd,setFormEnd]=useState('0.5');
 const [formKind,setFormKind]=useState<LabelKind>('bend');
 const annotationId=()=>('label-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));

 async function loadRecording(input:File){
  setMessage('');setPlaying(false);
  if(!/\.wav$/i.test(input.name)){setMessage('Please choose a WAV recording.');return;}
  if(input.size>35*1024*1024){setMessage('Source WAV limit is 35 MB.');return;}
  const Context=window.AudioContext;
  if(!Context){setMessage('Audio decoding is unavailable in this browser.');return;}
  const context=new Context();
  let data:AudioBuffer;
  try{
   try{data=await context.decodeAudioData(await input.arrayBuffer());}
   catch{throw Error('Unable to decode WAV. Try 16-bit PCM WAV.');}
   const length=Math.min(40,data.duration);
   if(length<.08)throw Error('The recording must be at least 0.08 seconds long.');
   const samples=data.getChannelData(0),number=620;
   const p:number[]=[];
   for(let i=0;i<number;i++){
    const lo=Math.floor((i/number)*length*data.sampleRate);
    const hi=Math.min(samples.length,Math.ceil(((i+1)/number)*length*data.sampleRate));
    let max=0;
    for(let s=lo;s<hi;s++)max=Math.max(max,Math.abs(samples[s]));
    p.push(max);
   }
   if(objectURL.current)URL.revokeObjectURL(objectURL.current);
   const next=URL.createObjectURL(input);objectURL.current=next;
   setUrl(next);setFile(input);setDuration(length);setPeaks(p);setTime(0);setZoom(1);setStartView(0);
   setSelection(null);setDragStart(null);setSelected(null);setAnnotations([]);
   setPredictions([]);setPredictionState('idle');setPredictionError('');setSessionId('session-001');
   if(data.duration>40)setMessage('Only the first 40 seconds are available for annotation and comparison.');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not load audio.')}
  finally{await context.close().catch(()=>{});}
 }
 function onTimeUpdate(){
  const node=audio.current;if(!node)return;
  if(node.currentTime>=duration){node.pause();node.currentTime=duration;setPlaying(false);setTime(duration);return;}
  setTime(node.currentTime);
 }
 function playPause(){
  const node=audio.current;if(!node)return;
  if(node.paused){if(node.currentTime>=duration-.05)node.currentTime=0;void node.play().then(()=>setPlaying(true)).catch(()=>setMessage('Playback was blocked by the browser.'));}
  else{node.pause();setPlaying(false);}
 }
 function seek(value:number){const t=clamp(value,0,duration);if(audio.current)audio.current.currentTime=t;setTime(t);}
 function atPointer(event:ReactPointerEvent<SVGSVGElement>){
  const rect=event.currentTarget.getBoundingClientRect();
  const px=(event.clientX-rect.left)/rect.width*WIDTH;
  return clamp(startView+(px-LEFT)/(RIGHT-LEFT)*visibleLength,0,duration);
 }
 function pointerDown(event:ReactPointerEvent<SVGSVGElement>){
  if(!file||event.button!==0)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  const t=atPointer(event);setDragStart(t);setSelection({start:t,end:t});
 }
 function pointerMove(event:ReactPointerEvent<SVGSVGElement>){
  if(dragStart===null)return;
  const t=atPointer(event);setSelection({start:Math.min(t,dragStart),end:Math.max(t,dragStart)});
 }
 function pointerUp(event:ReactPointerEvent<SVGSVGElement>){
  if(dragStart===null)return;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const end=atPointer(event),a=Math.min(dragStart,end),b=Math.max(dragStart,end);
  if(b-a<.06){seek(end);setSelection(null);}
  else{setSelection({start:a,end:b});setFormStart(a.toFixed(3));setFormEnd(b.toFixed(3));setFormKind(kind);setSelected(null);}
  setDragStart(null);
 }
 function addLabel(){
  const a=Number(formStart),b=Number(formEnd);
  const annotation:Annotation={id:annotationId(),type:formKind,start:a,end:b};
  if(!validAnnotation(annotation,duration)||b-a<.06){setMessage('Choose a valid interval of at least 0.06 seconds within the recording.');return;}
  setAnnotations(list=>[...list,annotation].sort((x,y)=>x.start-y.start));
  setSelected(annotation.id);setSelection(null);setMessage('Annotation added locally. Export it to keep a copy.');
 }
 function updateLabel(){
  if(!selected)return;
  const a:Annotation={id:selected,type:formKind,start:Number(formStart),end:Number(formEnd)};
  if(!validAnnotation(a,duration)||a.end-a.start<.06){setMessage('Enter a valid interval within this recording.');return;}
  setAnnotations(list=>list.map(x=>x.id===selected?a:x).sort((x,y)=>x.start-y.start));
  setMessage('Annotation updated locally.');
 }
 function editLabel(a:Annotation){
  setSelected(a.id);setSelection({start:a.start,end:a.end});
  setFormStart(a.start.toFixed(3));setFormEnd(a.end.toFixed(3));setFormKind(a.type);
  setStartView(clamp(a.start-.08,0,Math.max(0,duration-visibleLength)));
 }
 function changeZoom(value:number){
  const next=clamp(value,1,8);
  const nextLen=duration/next,center=startView+visibleLength/2;
  setZoom(next);setStartView(clamp(center-nextLen/2,0,Math.max(0,duration-nextLen)));
 }
 async function runPrediction(){
  if(!file)return;
  setPredictionState('loading');setPredictionError('');
  try{
   const prepared=await prepareAudioUpload(file);const data=new FormData();data.append('file',prepared.wav);
   const response=await fetch('/api/analyze',{method:'POST',body:data});
   const parsed=await response.json();
   if(!response.ok)throw Error(typeof parsed.detail==='string'?parsed.detail:'Audio API rejected the recording.');
   const events=parsed.technique_analysis?.events;
   if(!Array.isArray(events))throw Error('Server response did not contain technique events.');
   const types=['sustain','pitch_slide_candidate','vibrato_candidate'];
   setPredictions(events.filter((e:Prediction)=>types.includes(e.type)&&Number.isFinite(e.start)&&Number.isFinite(e.end)&&e.start>=0&&e.end>e.start&&e.end<=duration+.1));
   setPredictionState('ready');
  }catch(e){setPredictionState('error');setPredictionError(e instanceof Error?e.message:'Could not evaluate this recording.');}
 }
 async function importLabels(chosen:File){
  if(!file){setMessage('First load the WAV recording that these labels belong to.');return;}
  try{
   const parsed:unknown=JSON.parse(await chosen.text());
   const incoming=importedAnnotations(parsed,duration);
   if(annotations.length&&!window.confirm('Replace current annotations with imported annotations?'))return;
   setAnnotations(incoming);setSelected(null);setSelection(null);setMessage('Imported '+incoming.length+' annotation(s). Check that the labels match your WAV.');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not import annotation JSON.');}
 }
 function downloadManifest(){
  if(!file)return;
  const name=cleanFilename(file.name);
  saveFile(name+'-annotations.json',JSON.stringify(makeManifest(file.name,sessionId,annotations),null,2)+'\n','application/json');
 }
 function downloadCsv(){
  if(!file)return;
  saveFile(cleanFilename(file.name)+'-annotations.csv',toCsv(annotations),'text/csv');
 }
 function downloadEvaluation(){
  if(!file||!matches)return;
  const payload={method:'one-to-one greedy interval IoU matching',iou_threshold:threshold,
   note:'Exploratory, single-clip figures; not a validated research performance claim.',
   recording:file.name,reference_count:annotations.filter(a=>a.type!=='ordinary').length,
   predicted_count:predictions.length,session_id:sessionId,
   overall_micro:matches.overall,by_class:matches.byClass};
  saveFile(cleanFilename(file.name)+'-evaluation.json',JSON.stringify(payload,null,2)+'\n','application/json');
 }
 return <section className="annotation-studio">
  <p className="eyebrow">MODULE 05 / HUMAN-IN-THE-LOOP RESEARCH</p>
  <h1>Annotation <em>Studio.</em></h1>
  <p className="lead">Listen closely. Mark what you hear. Compare your own reference labels with experimental technique predictions.</p>
  <div className="studio-topline"><span>LOCAL-FIRST WORKSPACE</span><span>No audio storage · Explicit export only</span></div>
  <div className="panel studio-load">
    <div><AudioLines size={32}/><h2>Choose a guitar recording</h2><p>WAV up to 35 MB · annotate the first 40 seconds · audio playback remains in your browser</p></div>
    <button className="primary" onClick={()=>selectFile.current?.click()}><Upload size={16}/>{file?'Replace WAV':'Choose WAV'}</button>
    <input ref={selectFile} type="file" accept=".wav,audio/wav" hidden onChange={e=>{if(e.target.files?.[0])void loadRecording(e.target.files[0]);e.target.value='';}}/>
  </div>
  {message&&<p className="studio-message" role="status">{message}</p>}
  {file&&<>
   <audio ref={audio} src={url} preload="metadata" onTimeUpdate={onTimeUpdate} onEnded={()=>setPlaying(false)} aria-label="Uploaded guitar recording"/>
   <div className="panel studio-player">
    <div className="studio-heading"><div><strong>{file.name}</strong><small>{format(duration)} · Original recording stays on this device</small></div><span>{annotations.length} annotations</span></div>
    <div className="studio-controls">
     <button className="studio-icon-button" onClick={playPause} aria-label={playing?'Pause':'Play'}>{playing?<Pause size={20}/>:<Play size={20}/>}</button>
     <span className="studio-time">{format(time)} / {format(duration)}</span>
     <input aria-label="Seek audio" className="studio-seek" type="range" min="0" max={duration} step=".01" value={time} onChange={e=>seek(Number(e.target.value))}/>
     <button className="studio-icon-button" title="Zoom out" aria-label="Zoom out" onClick={()=>changeZoom(zoom/2)} disabled={zoom===1}><ZoomOut size={19}/></button>
     <span className="studio-zoom">{zoom}×</span>
     <button className="studio-icon-button" title="Zoom in" aria-label="Zoom in" onClick={()=>changeZoom(zoom*2)} disabled={zoom===8}><ZoomIn size={19}/></button>
     <button className="studio-icon-button" title="Reset zoom" aria-label="Reset zoom" onClick={()=>{setZoom(1);setStartView(0)}}><RotateCcw size={17}/></button>
    </div>
    {zoom>1&&<input aria-label="Pan visible recording window" className="studio-pan" type="range" min="0" max={Math.max(0,duration-visibleLength)} step=".01" value={startView} onChange={e=>setStartView(Number(e.target.value))}/>}
    <p className="muted">Drag over the waveform to select a time range, or click to seek. Zoom to inspect short passages.</p>
    <svg className="studio-waveform" viewBox={`0 0 ${WIDTH} 230`} role="img" aria-label="Interactive waveform; drag to select a time interval"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={()=>{setDragStart(null);setSelection(null)}} style={{touchAction:'none',cursor:'crosshair'}}>
      <rect x={LEFT} y={TOP} width={RIGHT-LEFT} height={BOTTOM-TOP} fill="#f7faff" rx="9"/>
      {[0,.25,.5,.75,1].map(i=><line key={i} x1={LEFT+i*(RIGHT-LEFT)} x2={LEFT+i*(RIGHT-LEFT)} y1={TOP} y2={BOTTOM} stroke="#e0e7f1" strokeWidth="1"/>)}
      {peaks.map((p,i)=>{
       const t=(i+.5)/peaks.length*duration;if(!within(t))return null;
       const x=project(t);const h=Math.max(2,p*68);
       return <line key={i} x1={x} x2={x} y1={99-h} y2={99+h} stroke="#6da9e9" strokeWidth={Math.max(1,(RIGHT-LEFT)/peaks.length*.8)} strokeLinecap="round"/>;
      })}
      {annotations.filter(a=>a.end>=startView&&a.start<=viewEnd).map(a=>
       <g key={a.id}><rect x={project(Math.max(a.start,startView))} y={TOP} width={Math.max(1,project(Math.min(a.end,viewEnd))-project(Math.max(a.start,startView)))} height={BOTTOM-TOP}
        fill={LABEL_COLORS[a.type]} opacity={selected===a.id ? .30 : .17} stroke={LABEL_COLORS[a.type]} strokeWidth={selected===a.id?2:1}/>
        <text x={project(Math.max(a.start,startView))+4} y="31" fontSize="10" fill="#263a55" fontWeight="600">{LABEL_NAMES[a.type]}</text></g>)}
      {selection&&<rect x={project(Math.max(startView,selection.start))} y={TOP} width={Math.max(1,project(Math.min(viewEnd,selection.end))-project(Math.max(startView,selection.start)))} height={BOTTOM-TOP} fill="#0071e3" opacity=".17" stroke="#0071e3" strokeWidth="2" strokeDasharray="5 4"/>}
      {showPredictions&&predictions.filter(p=>p.end>=startView&&p.start<=viewEnd).map((p,i)=>
       <rect key={i} x={project(Math.max(p.start,startView))} y="188" width={Math.max(2,project(Math.min(p.end,viewEnd))-project(Math.max(p.start,startView)))} height="14" rx="3"
        fill={matches?.matchedPredictionIndices.includes(predictions.indexOf(p))?'#1e9a7f':'#ec8c73'} opacity=".9"/>)}
      <line x1={project(clamp(time,startView,viewEnd))} x2={project(clamp(time,startView,viewEnd))} y1={TOP} y2="203" stroke="#0b65d5" strokeWidth="2"/>
      {[0,.25,.5,.75,1].map(i=><text key={i} x={LEFT+i*(RIGHT-LEFT)} y="222" textAnchor="middle" fontSize="12" fill="#6e7480">{format(startView+i*visibleLength)}</text>)}
    </svg>
    <div className="studio-legend"><span><i style={{background:'#0071e3'}}/> Your annotation</span><span><i style={{background:'#1e9a7f'}}/> Matched prediction</span><span><i style={{background:'#ec8c73'}}/> Unmatched prediction</span></div>
   </div>
   <div className="studio-columns">
    <div className="panel studio-edit">
     <div className="studio-heading"><div><h2>{picked?'Edit annotation':'Add annotation'}</h2><small>Independent human reference · not model-generated</small></div><Plus size={20}/></div>
     <div className="studio-fields">
      <label>Technique<select value={formKind} onChange={e=>{setFormKind(e.target.value as LabelKind);setKind(e.target.value as LabelKind)}}>{LABELS.map(x=><option key={x} value={x}>{LABEL_NAMES[x]}</option>)}</select></label>
      <label>Start (s)<input type="number" min="0" max={duration} step=".01" value={formStart} onChange={e=>setFormStart(e.target.value)}/></label>
      <label>End (s)<input type="number" min="0" max={duration} step=".01" value={formEnd} onChange={e=>setFormEnd(e.target.value)}/></label>
     </div>
     <div className="studio-actions">
      <button className="primary" onClick={picked?updateLabel:addLabel}>{picked?'Save changes':'Add interval'}</button>
      {picked&&<button className="secondary" onClick={()=>{setSelected(null);setSelection(null)}}>New interval</button>}
     </div>
    </div>
    <div className="panel studio-labels">
     <div className="studio-heading"><div><h2>Reference labels</h2><small>{annotations.length} labeled intervals</small></div></div>
     <div className="studio-label-list">
      {annotations.length===0?<p className="muted">Select a passage on the waveform, choose a technique, and click Add interval.</p>:
      annotations.map(a=><div className={'studio-label-row '+(selected===a.id?'active':'')} key={a.id}>
       <button onClick={()=>{editLabel(a);seek(a.start)}}><i style={{background:LABEL_COLORS[a.type]}}/>{LABEL_NAMES[a.type]} <small>{format(a.start)} – {format(a.end)}</small></button>
       <button title="Delete annotation" aria-label={'Delete '+LABEL_NAMES[a.type]} onClick={()=>{setAnnotations(v=>v.filter(x=>x.id!==a.id));if(selected===a.id)setSelected(null)}}><Trash2 size={15}/></button>
      </div>)}
     </div>
    </div>
   </div>
   <div className="panel studio-eval">
    <div className="studio-heading"><div><h2>Human vs. algorithm</h2><small>Existing rule-based API · one-to-one temporal IoU matching</small></div><button className="secondary" onClick={()=>void runPrediction()} disabled={predictionState==='loading'}>{predictionState==='loading'?'Analyzing…':'Run model comparison'}</button></div>
    <p className="muted">For unbiased ground truth, annotate before revealing the predictions. Running comparison sends only a compact, normalized first-40-second WAV to the analysis API.</p>
    {predictionState==='error'&&<p className="error"><AlertTriangle size={15}/> {predictionError}</p>}
    {predictionState==='ready'&&matches&&<>
      <label className="studio-checkbox"><input type="checkbox" checked={showPredictions} onChange={e=>setShowPredictions(e.target.checked)}/> Show predicted intervals on the waveform</label>
      <div className="studio-score-grid">
       <div><small>PRECISION</small><strong>{scoreText(matches.overall.precision)}</strong></div>
       <div><small>RECALL</small><strong>{scoreText(matches.overall.recall)}</strong></div>
       <div><small>F1 SCORE</small><strong>{scoreText(matches.overall.f1)}</strong></div>
       <div><small>TP / FP / FN</small><strong>{matches.overall.tp} / {matches.overall.fp} / {matches.overall.fn}</strong></div>
      </div>
      <label className="studio-iou">Required temporal IoU: <strong>{threshold.toFixed(2)}</strong><input type="range" min=".1" max=".8" step=".05" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label>
      <div className="studio-score-rows">{(Object.entries(matches.byClass) as [keyof typeof PREDICTION_NAMES,typeof matches.overall][]).map(([k,v])=>
       <div key={k}><strong>{PREDICTION_NAMES[k]}</strong><span>Precision {scoreText(v.precision)} · Recall {scoreText(v.recall)} · F1 {scoreText(v.f1)}</span><small>{v.tp} matched · {v.fp} extra · {v.fn} missed</small></div>)}</div>
      <p className="muted">“—” means undefined (no denominator), not 0% accuracy. Bend and slide share one prediction class; ordinary playing is excluded from scoring. These are single-clip exploratory metrics, not validated real-world performance.</p>
    </>}
   </div>
   <div className="panel studio-export">
    <div className="studio-heading"><div><h2>Save research annotations</h2><small>No cloud database or automatic upload of labels</small></div><Download size={22}/></div>
    <label className="studio-session">Session identifier<input value={sessionId} maxLength={80} onChange={e=>setSessionId(e.target.value)} placeholder="performer-session-1"/></label>
    <div className="studio-actions">
     <button className="primary" onClick={downloadManifest}><FileJson size={16}/> Export validation JSON</button>
     <button className="secondary" onClick={downloadCsv}><FileSpreadsheet size={16}/> Export CSV</button>
     <button className="secondary" disabled={!matches} onClick={downloadEvaluation}><Download size={16}/> Export evaluation</button>
     <button className="secondary" onClick={()=>importInput.current?.click()}><Upload size={16}/> Import annotations</button>
     <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e=>{if(e.target.files?.[0])void importLabels(e.target.files[0]);e.target.value=''}}/>
    </div>
    <p className="muted">The exported JSON follows the Python evaluation manifest schema. Save the WAV next to the manifest (or update its audio_path), then use the documented offline evaluator. Ordinary playing is excluded from scored labels. Reloading the page clears unsaved annotations.</p>
    <a className="method-link" href="https://github.com/vikas56655/srv-tonelab/blob/main/docs/ANNOTATION_STUDIO.md" target="_blank" rel="noreferrer"><CheckCircle2 size={15}/> Open documentation and validation workflow</a>
   </div>
  </>}
  {!file&&<div className="studio-empty"><AudioLines size={45}/><h2>Start with a short, clean guitar recording.</h2><p>Load a WAV to unlock the waveform, interval editor, model evaluation, and export tools.</p></div>}
 </section>;
}
