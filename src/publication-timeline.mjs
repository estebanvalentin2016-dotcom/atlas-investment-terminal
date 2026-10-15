// Provenance screening only. Publication evidence is user-supplied, not independently verified.
export function assessPublication(publicationEt,session,checkpoints=['09:45','10:00','10:30']){
 const unknown=checkpoints.map(time=>({time,status:'Unknown'}));
 if(typeof publicationEt!=='string'||typeof session!=='string')return unknown;
 if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(publicationEt)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(session))return unknown;
 const [date,time]=publicationEt.split('T');
 if(!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||Number(time.slice(0,2))>23||Number(time.slice(3))>59)return unknown;
 return checkpoints.map(checkpoint=>({time:checkpoint,status:publicationEt<=session+'T'+checkpoint?'Published by checkpoint (user-reported)':'After checkpoint'}));
}
