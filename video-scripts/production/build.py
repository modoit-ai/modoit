#!/usr/bin/env python3
"""Assemble the lecture video from slides, narration and talking-head clips.

Usage: build.py MANIFEST_URL SLIDES_ZIP_URL OUT.mp4
manifest: {"segments":[{"id","kind","audio","video"?}], ...}
"""
import json, os, subprocess, sys, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor

W = os.path.expanduser('~/build')
os.makedirs(W, exist_ok=True)
os.chdir(W)
man_url, zip_url, out = sys.argv[1:4]
PRE, POST = 0.2, 0.45  # silence before/after each narration line


def get(url, path):
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return path


def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode())


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(' '.join(cmd[-3:]) + '\n' + r.stderr[-1500:])


man = json.load(open(get(man_url, 'manifest.json')))
zipfile.ZipFile(get(zip_url, 'slides.zip')).extractall('slides')
subs = json.load(open('slides/subs.json'))
segs = man['segments']


def fetch(s):
    get(s['audio'], f"a_{s['id']}.wav")
    if s.get('video'):
        get(s['video'], f"v_{s['id']}.mp4")


with ThreadPoolExecutor(8) as ex:
    list(ex.map(fetch, segs))


def build(s):
    sid = s['id']
    a = f'a_{sid}.wav'
    ad = dur(a)
    D = PRE + ad + POST
    chunks = subs[sid]
    weights = [max(len(c), 4) for c in chunks]
    tot = sum(weights)
    inputs = ['-loop', '1', '-t', f'{D:.3f}', '-i', f'slides/slide_{sid}.png']
    fc = ['[0:v]scale=1920:1080,fps=30,format=yuv420p[bg]']
    last = 'bg'
    n = 1
    if s['kind'] == 'talk':
        inputs += ['-i', f'v_{sid}.mp4']
        fc.append(f'[1:v]scale=1080:1080,fps=30,trim=0:{ad:.3f},setpts=PTS-STARTPTS,'
                  f'tpad=start_mode=clone:start_duration={PRE}:stop_mode=clone:stop_duration={POST + 1}[tv]')
        fc.append('[bg][tv]overlay=840:0:shortest=0[bt]')
        last = 'bt'
        n = 2
    t = PRE
    for k, c in enumerate(chunks):
        d = ad * weights[k] / tot
        inputs += ['-loop', '1', '-t', f'{D:.3f}', '-i', f'slides/sub_{sid}_{k}.png']
        end = t + d if k < len(chunks) - 1 else D
        fc.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{t:.3f},{end:.3f})'[o{k}]")
        last = f'o{k}'
        n += 1
        t += d
    fc.append(f'[{last}]fade=in:st=0:d=0.25,trim=0:{D:.3f}[vout]')
    inputs += ['-i', a]
    fc.append(f'[{n}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(PRE*1000)}|{int(PRE*1000)},apad,atrim=0:{D:.3f}[aout]')
    run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
         '-t', f'{D:.3f}', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', f'seg_{sid}.mp4'])
    return sid, D


with ThreadPoolExecutor(4) as ex:
    res = list(ex.map(build, segs))
print('segments', len(res), 'total', round(sum(d for _, d in res), 1), 's', flush=True)
with open('list.txt', 'w') as f:
    for s in segs:
        f.write(f"file 'seg_{s['id']}.mp4'\n")
run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', out])
print('OK', out, round(dur(out), 1), flush=True)
