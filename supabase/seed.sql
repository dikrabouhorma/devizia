-- Salon de démonstration, accessible sur /atelier-soie sans compte.
insert into public.salons (slug, name, planity_url)
values ('atelier-soie', 'Atelier Soie', 'https://www.planity.com')
on conflict (slug) do nothing;
