-- Fixes "infinite recursion detected in policy for relation memberships"
-- (Postgres 42P17), found by running the real integration tests against a
-- live Supabase project. The "memberships_select_same_org" policy from
-- migration 0001 subqueried "memberships" from within its own policy body
-- — evaluating that subquery re-triggers the same policy, which subqueries
-- memberships again, forever. This affected every select against
-- organizations too, since that policy's subquery reads memberships.
--
-- Fix: a SECURITY DEFINER helper function. Functions marked SECURITY
-- DEFINER run with the privileges of their owner (the migration role,
-- which bypasses RLS), so the read inside the function does not re-trigger
-- policy evaluation — breaking the recursion.
--
-- Deliberately takes NO parameters and reads auth.uid() internally rather
-- than accepting a target user id as an argument. PostgREST auto-exposes
-- public-schema functions as RPC endpoints; a parameterized version would
-- let any authenticated caller pass an arbitrary user id and enumerate
-- that other user's organization memberships — an information-leak vector
-- unrelated to the recursion bug this migration fixes. Because this
-- version only ever resolves to the caller's own auth.uid(), calling it
-- directly can never reveal another user's data.
create or replace function public.active_organization_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.status <> 'suspended'
$$;

revoke execute on function public.active_organization_ids() from public;
grant execute on function public.active_organization_ids() to authenticated;

drop policy if exists "organizations_select_own_memberships" on "organizations";
create policy "organizations_select_own_memberships"
on "organizations"
for select
to authenticated
using (
  id in (select public.active_organization_ids())
);

drop policy if exists "memberships_select_same_org" on "memberships";
create policy "memberships_select_same_org"
on "memberships"
for select
to authenticated
using (
  organization_id in (select public.active_organization_ids())
);
