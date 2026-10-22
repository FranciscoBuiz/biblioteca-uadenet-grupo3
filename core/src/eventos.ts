export interface Evento { eventType: string; source: string; subject: string; data: unknown; receivedAt: number }

const eventos: Evento[] = [];

export const publicar = (e: Omit<Evento, "receivedAt">) => { eventos.push({ ...e, receivedAt: Math.floor(Date.now() / 1000) }); };
export const listar = (): Evento[] => [...eventos];
