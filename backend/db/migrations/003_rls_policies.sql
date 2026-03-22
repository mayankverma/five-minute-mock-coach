-- Migration 003: Row Level Security policies

-- Questions are public read
ALTER TABLE question ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are public" ON question FOR SELECT USING (true);
ALTER TABLE question_company_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Question maps are public" ON question_company_map FOR SELECT USING (true);

-- User-owned tables: users can only access their own data
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their profile" ON user_profile FOR ALL USING (auth.uid() = user_id);

ALTER TABLE story ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their stories" ON story FOR ALL USING (auth.uid() = user_id);

ALTER TABLE job_workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their workspaces" ON job_workspace FOR ALL USING (auth.uid() = user_id);

ALTER TABLE interview_round ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their rounds" ON interview_round FOR ALL USING (auth.uid() = user_id);

ALTER TABLE debrief ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their debriefs" ON debrief FOR ALL USING (auth.uid() = user_id);

ALTER TABLE score_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their scores" ON score_entry FOR ALL USING (auth.uid() = user_id);

ALTER TABLE practice_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their sessions" ON practice_session FOR ALL USING (auth.uid() = user_id);

ALTER TABLE drill_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their drill progress" ON drill_progression FOR ALL USING (auth.uid() = user_id);

ALTER TABLE coaching_strategy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their strategy" ON coaching_strategy FOR ALL USING (auth.uid() = user_id);

ALTER TABLE interview_pattern ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their patterns" ON interview_pattern FOR ALL USING (auth.uid() = user_id);

ALTER TABLE recruiter_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their feedback" ON recruiter_feedback FOR ALL USING (auth.uid() = user_id);

ALTER TABLE outcome_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their outcomes" ON outcome_log FOR ALL USING (auth.uid() = user_id);

ALTER TABLE resume_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their resume" ON resume_analysis FOR ALL USING (auth.uid() = user_id);

ALTER TABLE positioning_statement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their positioning" ON positioning_statement FOR ALL USING (auth.uid() = user_id);

ALTER TABLE linkedin_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their linkedin" ON linkedin_analysis FOR ALL USING (auth.uid() = user_id);

ALTER TABLE comp_strategy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their comp" ON comp_strategy FOR ALL USING (auth.uid() = user_id);

ALTER TABLE session_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their session logs" ON session_log FOR ALL USING (auth.uid() = user_id);

ALTER TABLE story_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their story usage" ON story_usage FOR ALL USING (
    EXISTS (SELECT 1 FROM story WHERE story.id = story_usage.story_id AND story.user_id = auth.uid())
);

ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their question history" ON user_question_history FOR ALL USING (auth.uid() = user_id);
