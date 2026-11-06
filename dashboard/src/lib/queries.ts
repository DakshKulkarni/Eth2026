import { useQuery } from '@tanstack/react-query';
import { api, type LiveEvent } from './api';

export const useOverview = () => useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 5000 });
export const useAnchors = () => useQuery({ queryKey: ['anchors'], queryFn: api.anchors, refetchInterval: 20000 });
export const useCertificates = () => useQuery({ queryKey: ['certs'], queryFn: api.certificates, refetchInterval: 30000 });
export const useProcedure = () => useQuery({ queryKey: ['procedure'], queryFn: api.procedure, staleTime: Infinity });
export const useBacklog = () =>
  useQuery({
    queryKey: ['events-backlog'],
    queryFn: async () => (await (await fetch('/api/events?limit=800')).json()) as { events: LiveEvent[] },
    refetchInterval: 8000,
  });
