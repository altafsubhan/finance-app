-- Make shared access connections bidirectional for data visibility.
-- A single row in shared_access should allow both users to see each other's shared data.

CREATE OR REPLACE FUNCTION public.get_shared_user_ids()
RETURNS UUID[] AS $$
DECLARE
  ids UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT ARRAY_AGG(DISTINCT id) INTO ids
  FROM (
    SELECT auth.uid() AS id
    UNION
    -- Users who shared with the current user
    SELECT owner_id FROM public.shared_access WHERE shared_with_id = auth.uid()
    UNION
    -- Users the current user shared with
    SELECT shared_with_id FROM public.shared_access WHERE owner_id = auth.uid()
  ) shared;

  RETURN COALESCE(ids, ARRAY[auth.uid()]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_shared_user_ids() TO authenticated;
