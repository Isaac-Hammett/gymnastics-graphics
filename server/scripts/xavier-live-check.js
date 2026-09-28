// Runs XavierService against the recorded ECAC Virtius JSON with the real Jev
// provider. Needs TYPESAFE_API_KEY in the environment. Prints recommendations
// and latency; never prints the key.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CompetitionStateService } from '../lib/competitionState/index.js';
import { XavierService, JevProvider } from '../lib/xavier/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(fs.readFileSync(path.join(here, '../../recordings/ecac-2026/virtius-final.json'), 'utf8'));
const cs = new CompetitionStateService({ compId: 'ecac-2026' });
cs.ingest({ t: Date.now(), snapshot: snap });

const actions = [
  { id: 'graphic:standings', label: 'Standings' },
  { id: 'graphic:team-total', label: 'Team totals' },
  { id: 'graphic:clear', label: 'Clear Graphic' },
  { id: 'scene:Floor Cam', label: 'Floor Cam' }
];
const svc = new XavierService({ compId: 'ecac-2026', competitionState: cs, getActions: async () => actions, provider: new JevProvider() });
svc._onEvent({ type: 'scorePosted', event: 'FLOOR', athlete: { name: 'Daniel Gurevich' }, score: '13.350' });
svc.on('recommendations', (p) => console.log(JSON.stringify(p, null, 2)));
svc.on('status', (s) => console.log('STATUS', JSON.stringify(s)));
await svc.request();
