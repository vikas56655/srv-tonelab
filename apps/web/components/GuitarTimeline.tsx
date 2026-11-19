'use client';
import {useMemo,useState} from 'react';

export type Timeline = {
  method: string;
  pitch_track: Array<{time:number;hz:number|null;note:string|null;confidence:number;energy:number}>;
  onsets: Array<{time:number;strength:number}>;
  spectrogram: {times:number[];frequencies_hz:number[];intensity:number[][]};
  limitations: string;
};
const W=860,H=235,PAD=42;
const cx=(t:number,d:number)=>PAD+Math.max(0,Math.min(1,t/Math.max(.01,d)))*(W-PAD-12);
function hzToY(h:number,min:number,max:number){return H-32-(Math.log2(h)-Math.log2(min))/(Math.log2(max)-Math.log2(min))*(H-60)}
function guessNote(hz:number){const m=Math.round(69+12*Math.log2(hz/440));return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][(m+1200)%12]+(Math.floor(m/12)-1)}
export function GuitarTimeline({data,duration}:{data:Timeline;duration:number}){
 const [index,setIndex]=useState(0);
 const [showOnsets,setShowOnsets]=useState(true);
 const frames=data.pitch_track||[];
 const spec=data.spectrogram;
 const valid=frames.filter(p=>p.hz!==null&&p.hz>=75&&p.hz<=1100);
 const minHz=75,maxHz=1100;
 const active=frames[Math.min(index,Math.max(0,frames.length-1))];
 const pitchPaths=useMemo(()=>{
   const paths:string[]=[];let segment:string[]=[];let last=-10;
   frames.forEach((p,i)=>{
     if(p.hz===null||p.hz<minHz||p.hz>maxHz||i-last>1){
       if(segment.length>1)paths.push(segment.join(' '));
       segment=[];
     }
     if(p.hz!==null&&p.hz>=minHz&&p.hz<=maxHz){
       segment.push((segment.length?'L':'M')+cx(p.time,duration).toFixed(2)+','+hzToY(p.hz,minHz,maxHz).toFixed(2));last=i;
     }
   });
   if(segment.length>1)paths.push(segment.join(' '));
   return paths;
 },[frames,duration]);
 if(!spec||!frames.length) return <p className="muted">Time-resolved analysis is unavailable for this recording.</p>;
 const ticks=[0,duration/4,duration/2,3*duration/4,duration];
 return <section className="timeline-stack">
 <div className="panel chart">
   <div className="chart-heading"><div><span className="eyebrow">RESEARCH FEATURE / 02</span><h2>Time-resolved pitch</h2><p className="muted">Estimated note trajectory · monophonic baseline · gaps indicate uncertain pitch</p></div><label className="toggle"><input type="checkbox" checked={showOnsets} onChange={e=>setShowOnsets(e.target.checked)}/> Show onset candidates</label></div>
   <svg viewBox={`0 0 ${W} ${H}`} className="analysis-svg" role="img" aria-label="Pitch frequency plotted versus time with optional note onset markers">
      {[110,220,440,880].map(h=><g key={h}><line x1={PAD} x2={W-12} y1={hzToY(h,minHz,maxHz)} y2={hzToY(h,minHz,maxHz)} stroke="#514237" strokeDasharray="4 6"/><text x="4" y={hzToY(h,minHz,maxHz)+4} fill="#a99584" fontSize="12">{guessNote(h)}</text></g>)}
      {ticks.map((t,i)=><text key={i} x={cx(t,duration)} y={H-7} textAnchor="middle" fontSize="11" fill="#aa9481">{t.toFixed(1)}s</text>)}
      {showOnsets&&data.onsets.map((p,i)=><line key={i} x1={cx(p.time,duration)} x2={cx(p.time,duration)} y1="10" y2={H-32} stroke="#78b9af" opacity=".5" strokeDasharray="3 5"/>)}
      {pitchPaths.map((path,i)=><path key={i} d={path} fill="none" stroke="#efb37d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>)}
      {active?.hz!==null&&active?.hz!==undefined&&<circle cx={cx(active.time,duration)} cy={hzToY(Math.max(minHz,Math.min(maxHz,active.hz)),minHz,maxHz)} r="6" fill="#ffcf95" stroke="#231913" strokeWidth="2"/>}
      <line x1={cx(active?.time||0,duration)} x2={cx(active?.time||0,duration)} y1="5" y2={H-30} stroke="#f4d8b5" opacity=".4"/>
   </svg>
   <div className="scrubber"><label htmlFor="pitch-time">Inspect time</label><input id="pitch-time" type="range" min={0} max={frames.length-1} value={index} onChange={e=>setIndex(Number(e.target.value))}/><span className="readout">{(active?.time||0).toFixed(2)} s · {active?.note||'No confident note'} {active?.hz? `· ${active.hz.toFixed(0)} Hz`:''} · confidence {Math.round((active?.confidence||0)*100)}%</span></div>
 </div>
 <div className="panel chart">
   <div className="chart-heading"><div><span className="eyebrow">RESEARCH FEATURE / 03</span><h2>Time-frequency spectrogram</h2><p className="muted">Log-frequency bands · brighter colors show relatively stronger energy</p></div></div>
   <svg viewBox={`0 0 ${W} ${H}`} className="analysis-svg" role="img" aria-label="Heatmap of audio energy across time and frequency">
   {spec.intensity.map((col,i)=>col.map((v,j)=>{
     const xx=PAD+i*(W-PAD-12)/spec.intensity.length;
     const yy=H-32-(j+1)*(H-47)/col.length;
     const power=Math.max(0,Math.min(1,v));
     return <rect key={i+'-'+j} x={xx} y={yy} width={(W-PAD-12)/spec.intensity.length+.5} height={(H-47)/col.length+.6} fill={`hsl(${20+22*power} 75% ${8+62*power}%)`}/>;
   }))}
   {ticks.map((t,i)=><text key={i} x={cx(t,duration)} y={H-7} fontSize="11" fill="#aa9481" textAnchor="middle">{t.toFixed(1)}s</text>)}
   {([100,250,500,1000,2500,5000]).filter(v=>v<=Math.max(...spec.frequencies_hz)).map(v=>{
     const freqs=spec.frequencies_hz;let closest=0;for(let i=0;i<freqs.length;i++)if(Math.abs(Math.log(freqs[i]/v))<Math.abs(Math.log(freqs[closest]/v)))closest=i;
     return <text key={v} x="2" y={H-32-(closest+.5)*(H-47)/freqs.length+4} fontSize="11" fill="#ae9d8e">{v>=1000?`${v/1000}k`:v}</text>;
   })}
   <line x1={cx(active?.time||0,duration)} x2={cx(active?.time||0,duration)} y1="5" y2={H-32} stroke="#e8dbcc" opacity=".65"/>
   </svg>
   <div className="legend"><span>Lower energy</span><div className="gradient-swatch"/><span>Higher energy</span></div>
 </div>
 <div className="timeline-summary"><div><strong>{valid.length}/{frames.length}</strong><small>FRAMES WITH ESTIMATED PITCH</small></div><div><strong>{data.onsets.length}</strong><small>ONSET CANDIDATES</small></div><div><strong>{frames.length}</strong><small>TIME WINDOWS ANALYZED</small></div></div>
 <div className="panel chart"><h2>How reliable are these results?</h2><p className="muted">The confidence value is autocorrelation peak strength — <strong>not</strong> a calibrated probability that the note is correct. Missing points are deliberate abstentions, and chords may lead to octave mistakes. We evaluate this tracker on original synthetic notes, slides and vibrato as a first sanity check, then need separately annotated real-guitar recordings before claiming musical accuracy.</p><a className="method-link" href="https://github.com/vikas56655/srv-tonelab/blob/main/docs/EVALUATION.md" target="_blank" rel="noreferrer">Read benchmark methodology ↗</a></div><p className="muted"><strong>Interpretation:</strong> {data.limitations} Neither onset count nor the pitch curve measures the number of notes performed. Bends and vibrato require further validation.</p>
 </section>;
}
