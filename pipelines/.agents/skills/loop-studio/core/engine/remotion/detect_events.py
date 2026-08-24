import subprocess, numpy as np, json, sys
FPS=15
def events(path, seg):
    p=subprocess.run(['ffmpeg','-v','error','-i',path,'-vf',f'fps={FPS},scale=160:90,format=gray','-f','rawvideo','-'],capture_output=True)
    n=160*90
    fr=np.frombuffer(p.stdout,dtype=np.uint8).reshape(-1,n).astype(np.float32)
    d=np.abs(np.diff(fr,axis=0)).mean(axis=1)
    t=np.arange(len(d))/FPS
    # normalize; find peaks above threshold with min spacing
    thr=d.mean()+0.4*d.std()
    peaks=[]
    last=-9
    order=np.argsort(-d)
    picked=[]
    for i in order:
        if d[i]<thr: break
        ti=t[i]
        if all(abs(ti-pj)>0.4 for pj in picked):
            picked.append(ti); peaks.append((round(float(ti),2), round(float(d[i]/ (d.max()+1e-9)),3)))
    peaks.sort()
    return {'seg':seg,'dur':round(len(d)/FPS,2),'peakmax':round(float(d.max()),2),'n':len(peaks),'events':peaks}
segs=[('intro','out/intro_v16_nm.mp4'),('act1','out/Act1_v20.mp4'),('act2','out/Act2_v14.mp4'),('act3','out/Act3_v16.mp4'),('act4','out/Act4_v13_final.mp4')]
out={}
for name,path in segs:
    out[name]=events(path,name)
    print(f"{name}: {out[name]['n']} events, dur {out[name]['dur']}s")
json.dump(out, open('out/events.json','w'), indent=0)
