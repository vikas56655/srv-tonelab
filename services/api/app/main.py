"""SRV ToneLab: educational audio feature extraction, no copyrighted audio."""
import io,math,wave
import numpy as np
from fastapi import FastAPI,UploadFile,File,HTTPException
app=FastAPI(title='SRV ToneLab API',version='0.1.0')
ITEMS=[dict(title='Texas Flood',album='Texas Flood',year=1983,note='Expressive slow blues'),dict(title='Pride and Joy',album='Texas Flood',year=1983,note='Driving Texas shuffle'),dict(title='Lenny',album='Texas Flood',year=1983,note='Melodic instrumental'),dict(title='Cold Shot',album="Couldn't Stand the Weather",year=1984,note='Laid-back blues groove'),dict(title='Riviera Paradise',album='In Step',year=1989,note='Atmospheric instrumental')]
@app.get('/health')
def health():return {'status':'ok','version':'0.1.0'}
@app.get('/api/recordings')
def recordings():return {'items':ITEMS,'source':'Curated educational starter catalog'}
def analyze(x:np.ndarray,sr:int):
 if sr<8000 or sr>192000 or len(x)<1024 or len(x)/sr>45:raise ValueError('Audio must be 0.05–45 seconds, sampled at 8–192 kHz')
 x=np.clip(np.nan_to_num(x.astype('float64')),-1,1)
 peak=float(np.max(np.abs(x)));rms=float(np.sqrt(np.mean(x*x)))
 n=min(32768,len(x));part=x[len(x)//2-n//2:len(x)//2-n//2+n];part=part*np.hanning(n)
 fft=np.abs(np.fft.rfft(part));freq=np.fft.rfftfreq(n,1/sr);power=fft*fft
 centroid=float(np.sum(freq*power)/(np.sum(power)+1e-12))
 cs=np.cumsum(power);rolloff=float(freq[min(len(freq)-1,int(np.searchsorted(cs,.85*cs[-1])))])
 pitch=None
 if rms>.002:
  ac=np.fft.irfft(np.abs(np.fft.rfft(part,n=2*n))**2)[:n]
  lo=max(1,int(sr/1100));hi=min(n-1,int(sr/65))
  cand=np.arange(lo,hi)
  if len(cand):
   peaks=cand[(ac[cand]>ac[cand-1])&(ac[cand]>=ac[cand+1])]
   if len(peaks):
    highest=max(ac[peaks])
    select=peaks[ac[peaks]>=.86*highest]
    lag=int(select[0])
    if lag>0:pitch=float(sr/lag)
 note=None
 if pitch and pitch>0:
  midi=round(69+12*math.log2(pitch/440))
  note=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+str(midi//12-1)
 windows=np.array_split(x,110);envelope=[round(float(np.max(np.abs(w))),4) for w in windows if len(w)]
 bins=np.geomspace(35,min(18000,sr/2),96);spec=[]
 for hz in bins:
  k=int(np.argmin(np.abs(freq-hz)));spec.append({'hz':round(float(freq[k]),1),'db':round(float(20*np.log10(max(fft[k],1e-7))),2)})
 return dict(sample_rate=sr,duration_seconds=round(len(x)/sr,3),rms=round(rms,5),peak=round(peak,5),spectral_centroid_hz=round(centroid,1),spectral_rolloff_hz=round(rolloff,1),estimated_pitch_hz=round(pitch,2) if pitch else None,estimated_pitch_note=note,waveform=envelope,spectrum=spec,disclaimer='Exploratory measurements only. Monophonic pitch estimation is unreliable for chords and full mixes.')
@app.get('/api/demo-analysis')
def demo():
 sr=22050;t=np.arange(sr*3)/sr;env=(1-np.exp(-t*45))*np.exp(-t*1.3);x=env*(.42*np.sin(2*np.pi*220*t)+.17*np.sin(2*np.pi*440*t)+.08*np.sin(2*np.pi*660*t))
 return analyze(x,sr)
@app.post('/api/analyze')
async def uploaded(file:UploadFile=File(...)):
 if not file.filename or not file.filename.lower().endswith('.wav'):raise HTTPException(415,'Only PCM WAV files are supported')
 raw=await file.read(12*1024*1024+1)
 if len(raw)>12*1024*1024:raise HTTPException(413,'File exceeds 12 MB limit')
 try:
  with wave.open(io.BytesIO(raw),'rb') as w:
   sr=w.getframerate();channels=w.getnchannels();width=w.getsampwidth();frames=w.getnframes()
   if w.getcomptype()!='NONE' or channels not in (1,2) or width not in (1,2,3,4) or frames/sr>45:raise ValueError('Unsupported WAV encoding or length')
   if width==3:
    b=np.frombuffer(w.readframes(frames),dtype=np.uint8).reshape(-1,3)
    v=b[:,0].astype(np.int32)|(b[:,1].astype(np.int32)<<8)|(b[:,2].astype(np.int32)<<16)
    v=np.where(v & 0x800000,v-0x1000000,v).astype(float)/8388608
   else:
    dtype={1:np.uint8,2:np.int16,4:np.int32}[width]
    v=np.frombuffer(w.readframes(frames),dtype=dtype).astype(float)
    v=(v-128)/128 if width==1 else v/(2**(width*8-1))
   if channels==2:v=v.reshape(-1,2).mean(axis=1)
   return analyze(v,sr)
 except (ValueError,wave.Error,EOFError,ZeroDivisionError) as e:raise HTTPException(422,str(e))
