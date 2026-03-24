-- Add Spanish execution instructions column to task_templates
ALTER TABLE public.task_templates
  ADD COLUMN execution_instructions_es TEXT;

COMMENT ON COLUMN public.task_templates.execution_instructions_es IS
  'Spanish translation of execution_instructions. Frontend displays based on user language preference.';

-- Add Spanish execution instructions column to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN execution_instructions_es TEXT;

COMMENT ON COLUMN public.review_tasks.execution_instructions_es IS
  'Spanish translation of execution_instructions, copied from task_template at generation time.';