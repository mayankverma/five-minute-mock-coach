# Roles System Design (Future)

## Context

Roles are scattered across the codebase as strings — `question.roles_applicable` (23 roles), `user_profile.target_roles`, and 7 role-drill definitions in interview-coach-skill. There's no centralized roles table, no role-specific drill content in the app, and question generation doesn't consider the user's role.

**Goal:** Create a centralized roles system that powers role-specific question generation, scoring calibration, and drill content. Extensible beyond tech roles using comprehensive job taxonomies.

## Current State

**Role-drills (7 deep drill definitions):** Product Manager, Software Engineer, Designer, Data Scientist, UX Researcher, Operations/Biz Ops, Marketing

**Question bank roles (23):** backend_engineer, customer_success_manager, customer_support, data_analyst, data_engineer, data_scientist, devops_engineer, director, engineering_manager, executive, frontend_engineer, fullstack_engineer, ml_engineer, mobile_engineer, platform_engineer, product_manager, project_manager, qa_engineer, sales_engineer, security_engineer, software_engineer, sre, ux_designer

**Missing:** Broader job categories (finance, healthcare, legal, ops, sales, etc.) — see karpathy.ai/jobs for comprehensive BLS taxonomy of 342+ occupations.

## Future Plan

### 1. Roles Table

```sql
CREATE TABLE role (
    id TEXT PRIMARY KEY,                -- e.g., 'software_engineer'
    name TEXT NOT NULL,                  -- e.g., 'Software Engineer'
    category TEXT,                       -- e.g., 'engineering', 'product', 'design', 'data', 'business'
    seniority_levels TEXT[],            -- e.g., ['junior', 'mid', 'senior', 'staff', 'principal']
    has_role_drill BOOLEAN DEFAULT FALSE,
    drill_content JSONB,                -- role-specific drill questions/lenses from role-drills.md
    interview_patterns JSONB,           -- typical interview formats, round types, competencies
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Seed from existing data
- Import 23 roles from question bank
- Import 7 role-drill definitions with full drill content
- Map BLS/O*NET categories for future expansion

### 3. Integration points
- Question generation: use role to frame questions appropriately
- Scoring: calibrate expectations by role (PM vs Engineer vs Designer)
- Guided Practice Stage 5 (Role): load drill content for the user's role
- Question bank filtering: `roles_applicable` matches user's target role
- User profile: `target_roles` references the roles table

### 4. Expansion path
- Add roles from BLS taxonomy as needed
- Each role can have custom drill content or inherit from a parent category
- Community-contributed role drills for niche roles

## Quick Win (Do Now)

Improve question generation prompts by pulling in the user's role and seniority from their profile context — no new tables needed, just better prompts.
