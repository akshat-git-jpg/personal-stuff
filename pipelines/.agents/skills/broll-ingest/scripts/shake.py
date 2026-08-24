#!/usr/bin/env python3
"""Shake score: global motion via phase correlation, jitter = deviation from
smoothed (intentional) camera path. Score in px/frame at 480px width."""
import sys, cv2, numpy as np

def shake_score(path, t0=None, t1=None, sample_hz=12.5):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, round(fps / sample_hz))
    if t0: cap.set(cv2.CAP_PROP_POS_MSEC, t0 * 1000)
    end_ms = t1 * 1000 if t1 else None
    prev = None; dxs = []; dys = []; i = 0
    win = None
    while True:
        ok = cap.grab()
        if not ok: break
        if end_ms and cap.get(cv2.CAP_PROP_POS_MSEC) > end_ms: break
        if i % step == 0:
            ok, fr = cap.retrieve()
            if not ok: break
            g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
            h, w = g.shape
            g = cv2.resize(g, (480, int(480 * h / w))).astype(np.float32)
            if win is None:
                win = cv2.createHanningWindow((g.shape[1], g.shape[0]), cv2.CV_32F)
            if prev is not None:
                (dx, dy), _ = cv2.phaseCorrelate(prev, g, win)
                dxs.append(dx); dys.append(dy)
            prev = g
        i += 1
    cap.release()
    if len(dxs) < 5: return None
    dxs = np.array(dxs); dys = np.array(dys)
    # intentional path = moving average; jitter = residual
    k = 9
    ker = np.ones(k) / k
    sm_x = np.convolve(dxs, ker, mode='same'); sm_y = np.convolve(dys, ker, mode='same')
    jit = np.hypot(dxs - sm_x, dys - sm_y)
    return {"jitter_mean": float(np.mean(jit)), "jitter_p95": float(np.percentile(jit, 95)),
            "motion_mean": float(np.mean(np.hypot(dxs, dys))), "n": len(dxs)}

if __name__ == "__main__":
    path = sys.argv[1]
    t0 = float(sys.argv[2]) if len(sys.argv) > 2 else None
    t1 = float(sys.argv[3]) if len(sys.argv) > 3 else None
    r = shake_score(path, t0, t1)
    print(r)
