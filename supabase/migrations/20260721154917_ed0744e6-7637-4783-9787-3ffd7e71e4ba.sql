DELETE FROM public.stock_items WHERE id IN ('245f475e-9361-4a3a-b8f0-6e375a0398b5','d92b67d8-b7df-45e9-9a03-238a2b4cf254','d5ecc26b-0a20-45c2-a15b-c4d04db50468');
DELETE FROM public.import_rows WHERE job_id='0c186965-e7aa-4035-9953-d8f16809f3cc';
DELETE FROM public.import_files WHERE job_id='0c186965-e7aa-4035-9953-d8f16809f3cc';
DELETE FROM public.import_audit_logs WHERE job_id='0c186965-e7aa-4035-9953-d8f16809f3cc';
DELETE FROM public.import_row_notes WHERE row_id IN (SELECT id FROM public.import_rows WHERE job_id='0c186965-e7aa-4035-9953-d8f16809f3cc');
DELETE FROM public.import_jobs WHERE id='0c186965-e7aa-4035-9953-d8f16809f3cc';
UPDATE public.app_settings SET value = to_jsonb(false) WHERE key = 'ai_import_enabled';