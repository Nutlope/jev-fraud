import recording from '@/data/recording.json';
export function GET(){return Response.json(recording,{headers:{'Cache-Control':'no-store'}})}
