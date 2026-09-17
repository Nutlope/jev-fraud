"""Reproduce data/emails.json from the public DIFrauD test split."""
import hashlib,json,pathlib,random,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
url='https://huggingface.co/datasets/difraud/difraud/resolve/main/phishing/test.jsonl'
raw=urllib.request.urlopen(url).read()
rows=[json.loads(line) for line in raw.splitlines()]
rng=random.Random(42);chosen=[]
for label in [0,1]:
    pool=[(i,row) for i,row in enumerate(rows) if row['label']==label and 120<=len(row['text'])<=6000]
    chosen+=rng.sample(pool,50)
rng.shuffle(chosen)
out=[{'id':f'MSG-{n+1:03d}','sourceRow':i+1,'text':row['text'],'label':'fraud' if row['label'] else 'legitimate'} for n,(i,row) in enumerate(chosen)]
(root/'data/emails.json').write_text(json.dumps(out,indent=2)+'\n')
print('Source SHA256:',hashlib.sha256(raw).hexdigest())
