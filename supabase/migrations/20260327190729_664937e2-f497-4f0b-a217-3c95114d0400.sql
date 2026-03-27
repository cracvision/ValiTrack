CREATE UNIQUE INDEX idx_one_active_review_per_system 
ON public.review_cases (system_id) 
WHERE is_deleted = false AND status != 'approved';