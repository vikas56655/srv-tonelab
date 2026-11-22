'use client';
import {useState} from 'react';
export type TechniqueEvent = {
  type:'sustain'|'pitch_slide_candidate'|'vibrato_candidate';
  start:number;end:number;duration:number;median_pitch_hz:number;
  tracking_strength:number;mean_tracking_strength:number;description:string;
  pitch_spread_cents?:number;pitch_change_cents?:number;
  pitch_oscillation_range_cents?:number;estimated_oscillation_hz?:number;
};
export type Techniques = {
 events:TechniqueEvent[];
 counts:Record<string,number>;
 method:string;
 limitations:string;
};
const names:Record<string,string>={
 sustain:'Sustained pitch',
 pitch_slide_candidate:'Possible bend / slide',
 vibrato_candidate:'Possible vibrato'
};
const color:Record<string,string>={
 sustain:'#59a89e',
 pitch_slide_candidate:'#4994e8',
 vibrato_candidate:'#a18cda'
};
export function TechniquePanel({data,duration}:{data:Techniques;duration:number}){
 const [selected,setSelected]=useState<number|null>(null);
 const events=data.events||[];
 const picked=selected===null?null:events[selected]||null;
 return <section className="panel technique-panel" aria-label="Experimental guitar technique analyzer">
 <div className="chart-heading">
 <div>
 <span className="eyebrow">RESEARCH FEATURE / 04</span>
 <h2>Guitar Technique Analyzer</h2>
 <p className="muted">Experimental pitch gestures · no claims of SRV performance identification</p>
 </div>
 <span className="research-tag">RULE-BASED · EXPERIMENTAL</span>
 </div>
 <div className="technique-stats">
 {(['sustain','pitch_slide_candidate','vibrato_candidate'] as const).map(kind=>
  <div key={kind}><span style={{background:color[kind]}} className="tech-dot"/><strong>{data.counts?.[kind]||0}</strong><small>{names[kind]}</small></div>
 )}
 </div>
 <div className="technique-timeline" role="img" aria-label="Time ranges containing possible guitar techniques">
  <div className="technique-track">
  {events.map((event,i)=><button key={i}
    className={'technique-event '+(selected===i?'selected':'')}
    aria-label={names[event.type]+' from '+event.start+' to '+event.end+' seconds'}
    title={names[event.type]+' · '+event.start+'–'+event.end+'s'}
    style={{left:(event.start/Math.max(.01,duration)*100)+'%',
            width:(Math.max(.04,event.end-event.start)/Math.max(.01,duration)*100)+'%',
            background:color[event.type]}}
    onClick={()=>setSelected(i)}/>)}
  </div>
  <div className="technique-axis"><span>0s</span><span>{(duration/2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span></div>
 </div>
 {events.length?<>
  <div className="technique-list">
  {events.map((e,i)=><button key={i} className={'technique-row '+(selected===i?'chosen':'')} onClick={()=>setSelected(i)}>
   <span className="tech-dot" style={{background:color[e.type]}}/>
   <span><strong>{names[e.type]}</strong><small>{e.start.toFixed(2)} – {e.end.toFixed(2)}s</small></span>
   <span className="tech-metric">{e.type==='pitch_slide_candidate'?Math.round(e.pitch_change_cents||0)+' cents':
     e.type==='vibrato_candidate'?(e.estimated_oscillation_hz||0).toFixed(1)+' Hz':
     (e.duration).toFixed(2)+'s'}</span>
  </button>)}
  </div>
  {picked&&<div className="technique-details">
    <strong>{names[picked.type]}</strong>
    <p>{picked.description}.</p>
    <p>Median F0: {picked.median_pitch_hz.toFixed(1)} Hz · Tracking strength: {(picked.tracking_strength*100).toFixed(0)}% (not a classification probability).</p>
  </div>}
 </>:<p className="muted">No intervals met the conservative detection thresholds. This does not mean the recording contains no bends or vibrato; it may mean the pitch track is too uncertain or the recording is polyphonic.</p>}
 <p className="muted"><strong>Scientific limitation:</strong> {data.limitations}</p>
 <a className="method-link" href="https://github.com/vikas56655/srv-tonelab/blob/main/docs/TECHNIQUES.md" target="_blank" rel="noreferrer">Read detection methods and limitations ↗</a>
 </section>;
}
