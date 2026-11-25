-- The follow eligibility check only reads the caller's own profile; preserve the identity and type checks.
alter function public.can_user_follow_target(uuid,text,uuid) security invoker;
