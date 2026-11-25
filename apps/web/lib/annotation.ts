/** Browser-only, reproducible interval matching aligned with Python evaluate_labeled.py. */
export type LabelKind = 'sustain' | 'bend' | 'slide' | 'vibrato' | 'ordinary';
export type PredictionKind = 'sustain' | 'pitch_slide_candidate' | 'vibrato_candidate';
export type Annotation = {id:string;type:LabelKind;start:number;end:number};
export type Prediction = {type:PredictionKind;start:number;end:number;tracking_strength?:number};
export type Counts = {tp:number;fp:number;fn:number};
export type Scores = Counts & {precision:number|null;recall:number|null;f1:number|null};
export type MatchResult = {overall:Scores;byClass:Record<PredictionKind,Scores>;matchedPredictionIndices:number[];matchedAnnotationIds:string[]};
export const LABELS:LabelKind[] = ['sustain','bend','slide','vibrato','ordinary'];
export const LABEL_NAMES:Record<LabelKind,string> = {sustain:'Sustain',bend:'Bend',slide:'Slide',vibrato:'Vibrato',ordinary:'Ordinary playing'};
export const LABEL_COLORS:Record<LabelKind,string> = {sustain:'#2f9d85',bend:'#0071e3',slide:'#5b8def',vibrato:'#9269d3',ordinary:'#8a8a92'};
export const PREDICTION_NAMES:Record<PredictionKind,string>={sustain:'Sustain',pitch_slide_candidate:'Bend / slide candidate',vibrato_candidate:'Vibrato candidate'};
const CLASSES:PredictionKind[]=['sustain','pitch_slide_candidate','vibrato_candidate'];
const mapped=(type:LabelKind):PredictionKind|null=>type==='ordinary'?null:type==='bend'||type==='slide'?'pitch_slide_candidate':type==='vibrato'?'vibrato_candidate':'sustain';
export function validAnnotation(obj:unknown,duration:number):obj is Annotation {
 if(!obj||typeof obj!=='object')return false;
 const o=obj as Partial<Annotation>;
 return typeof o.id==='string'&&o.id.length>0&&LABELS.includes(o.type as LabelKind)
  &&typeof o.start==='number'&&typeof o.end==='number'
  &&Number.isFinite(o.start)&&Number.isFinite(o.end)&&o.start>=0&&o.start<o.end&&o.end<=duration+1e-6;
}
export function intervalIoU(a:{start:number;end:number},b:{start:number;end:number}):number{
 const overlap=Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start));
 const union=Math.max(a.end,b.end)-Math.min(a.start,b.start);
 return union>0?overlap/union:0;
}
function scores(c:Counts):Scores{
 const precision=c.tp+c.fp>0?c.tp/(c.tp+c.fp):null;
 const recall=c.tp+c.fn>0?c.tp/(c.tp+c.fn):null;
 const f1=precision!==null&&recall!==null?precision+recall===0?0:2*precision*recall/(precision+recall):null;
 return {...c,precision,recall,f1};
}
export function evaluateAnnotations(annotations:Annotation[],predictions:Prediction[],threshold=.3):MatchResult{
 if(!(threshold>0&&threshold<=1))throw Error('IoU threshold must be in (0, 1].');
 const normalized=annotations.filter(a=>mapped(a.type)!==null);
 const candidates:{iou:number;ai:number;pi:number}[]=[];
 for(let ai=0;ai<normalized.length;ai++){
  for(let pi=0;pi<predictions.length;pi++){
   if(mapped(normalized[ai].type)!==predictions[pi].type)continue;
   const iou=intervalIoU(normalized[ai],predictions[pi]);
   if(iou>=threshold)candidates.push({iou,ai,pi});
  }
 }
 candidates.sort((a,b)=>b.iou-a.iou||a.ai-b.ai||a.pi-b.pi);
 const usedA=new Set<number>(),usedP=new Set<number>();
 for(const c of candidates)if(!usedA.has(c.ai)&&!usedP.has(c.pi)){usedA.add(c.ai);usedP.add(c.pi)}
 const byClass={} as Record<PredictionKind,Scores>;
 for(const type of CLASSES){
  const refs=normalized.map((a,i)=>({a,i})).filter(v=>mapped(v.a.type)===type);
  const preds=predictions.map((p,i)=>({p,i})).filter(v=>v.p.type===type);
  const tp=refs.filter(v=>usedA.has(v.i)).length;
  byClass[type]=scores({tp,fp:preds.length-tp,fn:refs.length-tp});
 }
 const overallCounts=CLASSES.reduce((c,k)=>({tp:c.tp+byClass[k].tp,fp:c.fp+byClass[k].fp,fn:c.fn+byClass[k].fn}),{tp:0,fp:0,fn:0});
 return {overall:scores(overallCounts),byClass,matchedPredictionIndices:[...usedP],matchedAnnotationIds:[...usedA].map(i=>normalized[i].id)};
}
export function importedAnnotations(payload:unknown,duration:number):Annotation[]{
 if(!payload||typeof payload!=='object')throw Error('Expected JSON annotations or a validation manifest.');
 const p=payload as {labels?:unknown;annotations?:unknown;recordings?:unknown};
 let raw:unknown=p.annotations||p.labels;
 if(Array.isArray(p.recordings)){
  if(p.recordings.length!==1)throw Error('Import a manifest containing exactly one recording.');
  raw=(p.recordings[0] as {labels?:unknown})?.labels;
 }
 if(!Array.isArray(raw))throw Error('No annotations array found.');
 if(raw.length>500)throw Error('Limit imports to 500 annotations.');
 return raw.map((r,i)=>{
  if(!r||typeof r!=='object')throw Error('Invalid annotation row.');
  const x=r as Record<string,unknown>;
  const a:Annotation={id:'import-'+i+'-'+Math.random().toString(36).slice(2,9),type:x.type as LabelKind,start:Number(x.start),end:Number(x.end)};
  if(!validAnnotation(a,duration))throw Error('Invalid label or interval in annotation '+(i+1)+'.');
  return a;
 });
}
export function makeManifest(filename:string,sessionId:string,annotations:Annotation[]){
 return {schema_version:'1.0',recordings:[{id:filename.replace(/\.wav$/i,'').replace(/[^\w-]/g,'_')||'recording',
  audio_path:filename,session_id:sessionId.trim()||'unspecified-session',
  labels:annotations.filter(a=>a.type!=='ordinary').map(({type,start,end})=>({type,start:Number(start.toFixed(3)),end:Number(end.toFixed(3))}))}]};
}
export function toCsv(annotations:Annotation[]):string{
 return 'type,start_seconds,end_seconds,duration_seconds\n'+annotations.map(a=>[a.type,a.start.toFixed(3),a.end.toFixed(3),(a.end-a.start).toFixed(3)].join(',')).join('\n')+'\n';
}
