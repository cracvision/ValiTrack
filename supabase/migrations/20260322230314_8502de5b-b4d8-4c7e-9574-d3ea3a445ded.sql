-- Add execution_instructions column to task_templates
ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS execution_instructions TEXT DEFAULT '';

-- Add execution_instructions column to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS execution_instructions TEXT DEFAULT '';