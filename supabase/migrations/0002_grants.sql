-- DevizIA · droits explicites sur les tables
-- Les droits ne dépendent plus des réglages par défaut du projet Supabase :
-- les clientes passent uniquement par l'API (clé service), la lisseuse connectée
-- lit et modifie son salon, lit ses demandes et n'en change que le statut et l'ajustement.

revoke all on public.salons, public.drafts, public.quote_requests from anon, authenticated;

grant select, insert, update on public.salons to authenticated;
grant select on public.quote_requests to authenticated;
grant update (status, adjustment) on public.quote_requests to authenticated;

grant all on public.salons, public.drafts, public.quote_requests to service_role;
