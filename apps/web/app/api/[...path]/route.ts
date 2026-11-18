import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
const BASE=process.env.API_ORIGIN||'http://localhost:8000';
async function proxy(req:NextRequest,ctx:{params:Promise<{path:string[]}>}){
 const {path}=await ctx.params;
 const target=BASE.replace(/\/$/,'')+'/api/'+path.map(encodeURIComponent).join('/');
 try{
  const payload=req.method==='GET'?undefined:await req.arrayBuffer();
  if(payload&&payload.byteLength>12*1024*1024)return NextResponse.json({detail:'Maximum upload size: 12 MB'},{status:413});
  const res=await fetch(target,{method:req.method,body:payload,headers:{...(req.headers.get('content-type')?{'content-type':req.headers.get('content-type')!}:{})},cache:'no-store',signal:AbortSignal.timeout(25000)});
  return new NextResponse(res.body,{status:res.status,headers:{'content-type':res.headers.get('content-type')||'application/json','cache-control':'no-store'}});
 }catch{return NextResponse.json({detail:'Audio backend is currently unavailable. Try again shortly.'},{status:502})}
}
export const GET=proxy; export const POST=proxy;