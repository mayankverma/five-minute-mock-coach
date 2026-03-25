-- Store the raw profile text so users don't have to re-upload
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS profile_text TEXT;

-- Store section-by-section audit results
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS headline_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS about_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS experience_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS skills_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS photo_banner_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS featured_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS recommendations_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS url_completeness_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS content_strategy JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS cross_surface_gaps JSONB DEFAULT '[]';

-- Store how the profile was submitted
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'text';
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
