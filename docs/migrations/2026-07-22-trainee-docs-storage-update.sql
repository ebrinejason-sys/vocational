-- Ensure storage UPDATE policy exists for trainee-documents (upsert/replace).
-- Uploads now primarily go through the service-role API + signed upload URLs.

DROP POLICY IF EXISTS trainee_docs_storage_update ON storage.objects;
CREATE POLICY trainee_docs_storage_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  )
  WITH CHECK (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  );
