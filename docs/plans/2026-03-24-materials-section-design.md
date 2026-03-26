# Materials Section Design

> Design document for the Resume, LinkedIn, Pitch, and Outreach pages.
> Validated through brainstorming session on 2026-03-24.

---

## 1. Overview

Transform the existing tabbed Materials page into four standalone pages under the BUILD sidebar group. Resume is the gateway — uploading it unlocks Pitch and Outreach. LinkedIn works independently.

### Core Principles

- **Resume-first flow**: Resume upload is the foundation; it unlocks coaching value across the app.
- **Hybrid UX**: Instant analysis on upload/generate, plus "Refine with coach" chat for deeper iteration.
- **Structured resume data**: Parse uploads into editable sections (not file storage). The user iterates on structured content, not a PDF.
- **Workspace-aware resumes**: One master resume in General Prep. One optional job-specific resume per Job Workspace.
- **Cross-surface consistency**: Pitch, LinkedIn, and Outreach reference the resume's positioning strengths, creating a coherent candidate narrative.

---

## 2. Navigation & Routing

### Sidebar Structure

```
COACHING
  Dashboard
BUILD
  Resume          ← /resume (NEW route)
  Storybank       ← /stories (existing)
  LinkedIn        ← /linkedin (NEW route)
  Pitch           ← /pitch (NEW route)
  Outreach        ← /outreach (NEW route)
PRACTICE
  Practice
  Mock Interview
TRACK
  Progress
```

### Changes from Current State

- The tabbed `/materials` page is retired.
- Resume moves from MATERIALS to BUILD (it is the foundational artifact).
- LinkedIn, Pitch, Outreach move from MATERIALS tabs to BUILD nav items.
- Salary tab is removed from materials (future: Job Workspace context).
- Each page gets its own route and layout.

### Dependency & Unlock Flow

```
Resume Upload
  -> Resume Analysis (grade, dimensions, fixes, story seeds)
  -> Resume Builder (structured editable sections)
  -> Story Seeds -> Storybank

Resume Analysis UNLOCKS:
  -> Pitch (uses positioning strengths)
  -> Outreach (uses positioning + pitch hooks)

LinkedIn Audit (ALWAYS enabled, independent)
```

- **LinkedIn**: Always enabled. Standalone audit from pasted profile text.
- **Pitch**: Locked until resume is analyzed. Needs positioning strengths.
- **Outreach**: Locked until resume is analyzed. Benefits from pitch but not gated on it.

---

## 3. Resume Page

### 3.1 Workspace-Aware Resume Model

```
General Prep  ->  ONE master resume per user
Job Workspace ->  ONE optional job-specific resume per job
                  (falls back to master if not uploaded)
```

Features (mock interview, practice, pitch, etc.) resolve the active resume based on which workspace the user is in. Job resume can pre-populate from the master resume so the user tweaks rather than re-uploads.

### 3.2 Page States

The Resume page has three states:

**State 1 -- Empty (no resume uploaded)**

```
┌──────────────────────────────────────────────────────────────┐
│  Resume                                                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │              ┌──────────────────────┐                  │  │
│  │              │   drag & drop icon   │                  │  │
│  │              └──────────────────────┘                  │  │
│  │                                                        │  │
│  │         Upload your resume to get started              │  │
│  │                                                        │  │
│  │    Get an ATS compatibility audit, story seeds for     │  │
│  │    your storybank, and a structured resume you can     │  │
│  │    iterate on with your AI coach.                      │  │
│  │                                                        │  │
│  │    Accepts PDF and DOCX                                │  │
│  │                                                        │  │
│  │              [ Upload Resume ]                         │  │
│  │                                                        │  │
│  │    - - - - - - - - - - - - - - - - - -                 │  │
│  │    or drag and drop your file here                     │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Full-page dropzone. This is what the dashboard nudge links to.
- Accepts PDF and DOCX.
- On upload: file is sent to backend, text extracted, AI analysis runs, sections parsed.
- Shows a loading/processing state while analysis runs.

**State 2 -- Analysis + Builder (split pane)**

```
┌──────────────────────────────────────────────────────────────┐
│  Resume                                        [ Re-upload ] │
│                                                              │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │ RESUME BUILDER (left)     │ │ ANALYSIS CARD (right)    │  │
│  │                           │ │                          │  │
│  │ ┌───────────────────────┐ │ │  Overall Grade: B+       │  │
│  │ │ SUMMARY               │ │ │  ┌────────────────────┐  │  │
│  │ │ "Experienced PM with  │ │ │  │ ATS         Strong │  │  │
│  │ │  7 years building..." │ │ │  │ Recruiter   Mod    │  │  │
│  │ │              [edit]   │ │ │  │ Bullets     Weak   │  │  │
│  │ └───────────────────────┘ │ │  │ Seniority   Align  │  │  │
│  │                           │ │  │ Keywords    Strong │  │  │
│  │ ┌───────────────────────┐ │ │  │ Structure   Strong │  │  │
│  │ │ EXPERIENCE            │ │ │  │ Concerns    Mod    │  │  │
│  │ │                       │ │ │  │ Polish      Strong │  │  │
│  │ │ Stripe - Senior PM    │ │ │  └────────────────────┘  │  │
│  │ │ Jan 2023 - Present    │ │ │                          │  │
│  │ │ * Led migration...    │ │ │  Top Fixes:              │  │
│  │ │ * Reduced churn 40%.. │ │ │  1. [Fix] Bullet quality │  │
│  │ │ * Built analytics...  │ │ │  2. [Improve] Summary    │  │
│  │ │              [edit]   │ │ │  3. [Nice] Skills order  │  │
│  │ └───────────────────────┘ │ │                          │  │
│  │                           │ │  Story Seeds:            │  │
│  │ ┌───────────────────────┐ │ │  * "Reduced churn 40%"   │  │
│  │ │ EXPERIENCE            │ │ │    [Add to Storybank]    │  │
│  │ │ Google - PM           │ │ │  * "Built analytics..."  │  │
│  │ │ ...                   │ │ │    [Add to Storybank]    │  │
│  │ └───────────────────────┘ │ │                          │  │
│  │                           │ │                          │  │
│  │ ┌───────────────────────┐ │ │                          │  │
│  │ │ EDUCATION             │ │ │                          │  │
│  │ │ Stanford - MS CS      │ │ │                          │  │
│  │ │              [edit]   │ │ │                          │  │
│  │ └───────────────────────┘ │ │                          │  │
│  │                           │ │                          │  │
│  │ ┌───────────────────────┐ │ │                          │  │
│  │ │ SKILLS                │ │ │                          │  │
│  │ │ Python, SQL, dbt...   │ │ │                          │  │
│  │ │              [edit]   │ │ │                          │  │
│  │ └───────────────────────┘ │ │                          │  │
│  │                           │ │ [ Refine with Coach ]    │  │
│  └───────────────────────────┘ └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Left panel: Resume Builder with parsed, editable sections.
- Right panel: Analysis scorecard with grade circle, 8 dimension scores, top fixes (severity-tagged), and story seeds with "Add to Storybank" buttons.
- Each section in the builder has an [edit] toggle for inline editing.
- "Refine with Coach" button at the bottom of the analysis card.

**State 3 -- Coaching (right panel becomes chat)**

```
┌──────────────────────────────────────────────────────────────┐
│  Resume                                        [ Re-upload ] │
│                                                              │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │ RESUME BUILDER (left)     │ │ COACH CHAT (right)       │  │
│  │                           │ │                          │  │
│  │ ┌───────────────────────┐ │ │ ┌──────────────────────┐ │  │
│  │ │ SUMMARY               │ │ │ │ B+ | 3 fixes remain │ │  │
│  │ │ "Experienced PM with  │ │ │ └──────────────────────┘ │  │
│  │ │  7 years building..." │ │ │                          │  │
│  │ └───────────────────────┘ │ │ Coach: Your bullet for   │  │
│  │                           │ │ "Led migration" is a     │  │
│  │ ┌───────────────────────┐ │ │ responsibility, not an   │  │
│  │ │ EXPERIENCE            │ │ │ achievement. Try:        │  │
│  │ │                       │ │ │                          │  │
│  │ │ Stripe - Senior PM    │ │ │ "Drove microservices     │  │
│  │ │ Jan 2023 - Present    │ │ │  migration across 12     │  │
│  │ │ ╔═══════════════════╗ │ │ │  services, reducing      │  │
│  │ │ ║ * Led migration.. ║ │ │ │  deploy time 60% and     │  │
│  │ │ ║   (highlighted)   ║ │ │ │  eliminating 3hr weekly  │  │
│  │ │ ╚═══════════════════╝ │ │ │  rollback incidents"     │  │
│  │ │ * Reduced churn 40%.. │ │ │                          │  │
│  │ │ * Built analytics...  │ │ │  [ Apply ]  [ Skip ]     │  │
│  │ └───────────────────────┘ │ │                          │  │
│  │                           │ │ You: What about the      │  │
│  │ ┌───────────────────────┐ │ │ churn bullet?            │  │
│  │ │ EDUCATION             │ │ │                          │  │
│  │ │ Stanford - MS CS      │ │ │ Coach: That one is       │  │
│  │ └───────────────────────┘ │ │ strong already -- it     │  │
│  │                           │ │ has the XYZ formula...   │  │
│  │ ┌───────────────────────┐ │ │                          │  │
│  │ │ SKILLS                │ │ │ ┌──────────────────────┐ │  │
│  │ │ Python, SQL, dbt...   │ │ │ │ Type message...  [>] │ │  │
│  │ └───────────────────────┘ │ │ └──────────────────────┘ │  │
│  └───────────────────────────┘ └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Analysis card collapses to a summary bar (grade + fixes remaining) at the top of right panel.
- Chat takes over the right panel.
- Coach references specific resume sections; those sections highlight on the left (shown with the box around "Led migration").
- Coach suggestions include [ Apply ] and [ Skip ] buttons.
- Clicking [ Apply ] updates the corresponding section in the builder.
- Chat session is persisted (can resume later).

---

## 4. LinkedIn Page

### 4.1 Input

User pastes their LinkedIn URL or profile text. Unlike Resume, there is no file upload -- LinkedIn content is text-based input.

### 4.2 Page States

**State 1 -- Empty**

```
┌──────────────────────────────────────────────────────────────┐
│  LinkedIn                                                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │              [LinkedIn icon]                            │  │
│  │                                                        │  │
│  │         LinkedIn Profile Audit                         │  │
│  │                                                        │  │
│  │    Paste your LinkedIn profile text to get a           │  │
│  │    section-by-section audit calibrated to how          │  │
│  │    recruiters actually search and scan profiles.       │  │
│  │                                                        │  │
│  │    ┌────────────────────────────────────────────┐      │  │
│  │    │ Paste your LinkedIn profile text here...   │      │  │
│  │    │                                            │      │  │
│  │    │                                            │      │  │
│  │    └────────────────────────────────────────────┘      │  │
│  │                                                        │  │
│  │              [ Start Audit ]                           │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### State 2 -- Results + Coach (split pane)

```
┌──────────────────────────────────────────────────────────────┐
│  LinkedIn                                    [ Re-audit ]    │
│                                                              │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │ RESULTS CARD (left)       │ │ COACH CHAT (right)       │  │
│  │                           │ │                          │  │
│  │ Overall: B                │ │ Coach: Your headline is  │  │
│  │                           │ │ "Product Manager at      │  │
│  │ ┌───────────────────────┐ │ │ Stripe" -- that's what  │  │
│  │ │ Headline       Weak   │ │ │ 90% of PMs write. Try:  │  │
│  │ │ About          Strong │ │ │                          │  │
│  │ │ Experience     Mod    │ │ │ "PM who turned 40%      │  │
│  │ │ Skills         Weak   │ │ │ churn into a growth     │  │
│  │ │ Recommendations Weak  │ │ │ engine | ex-Google,     │  │
│  │ │ Photo/Banner   Mod    │ │ │ Stripe"                 │  │
│  │ │ Featured       None   │ │ │                          │  │
│  │ │ URL            Weak   │ │ │ This uses your earned   │  │
│  │ │ Completeness   72%    │ │ │ secret from your resume │  │
│  │ └───────────────────────┘ │ │ and is much more        │  │
│  │                           │ │ searchable.             │  │
│  │ Top Fixes:                │ │                          │  │
│  │ 1. [Fix] Headline --     │ │ [ Copy ]                 │  │
│  │    too generic            │ │                          │  │
│  │ 2. [Fix] Add 20+ skills  │ │ You: What about my       │  │
│  │    for search filters     │ │ about section?           │  │
│  │ 3. [Improve] Featured    │ │                          │  │
│  │    section empty          │ │ ┌──────────────────────┐ │  │
│  │                           │ │ │ Type message...  [>] │ │  │
│  │ Positioning Gaps:         │ │ └──────────────────────┘ │  │
│  │ Resume says X, LinkedIn   │ │                          │  │
│  │ doesn't reflect it.       │ │                          │  │
│  └───────────────────────────┘ └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 9-section audit scores on the left (from interview-coach-skill's linkedin command).
- Coach chat on the right from the start (no separate "Refine" button -- the audit naturally flows into coaching).
- If resume analysis exists, the coach references positioning strengths and flags cross-surface gaps.
- Coach suggestions have [ Copy ] buttons (user applies to LinkedIn manually, since we don't control LinkedIn).

---

## 5. Pitch Page

### 5.1 Input

No user input needed. Pitch is auto-generated from resume analysis (positioning strengths, likely concerns, career narrative). Locked until resume is uploaded.

### 5.2 Page States

**State 1 -- Locked (no resume)**

```
┌──────────────────────────────────────────────────────────────┐
│  Pitch                                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │              [lock icon]                                │  │
│  │                                                        │  │
│  │         Upload your resume to unlock Pitch             │  │
│  │                                                        │  │
│  │    Your positioning statement is generated from your   │  │
│  │    resume analysis. It becomes the consistency anchor  │  │
│  │    for your LinkedIn, outreach, and interview answers. │  │
│  │                                                        │  │
│  │              [ Go to Resume ]                          │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**State 2 -- Generated + Coach (split pane)**

```
┌──────────────────────────────────────────────────────────────┐
│  Pitch                                       [ Regenerate ]  │
│                                                              │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │ POSITIONING CARD (left)   │ │ COACH CHAT (right)       │  │
│  │                           │ │                          │  │
│  │ Core Statement:           │ │ Coach: Here's your       │  │
│  │ "I help B2B SaaS teams    │ │ positioning statement.   │  │
│  │  turn churn signals into  │ │ The core hook uses your  │  │
│  │  growth engines. After    │ │ earned secret from the   │  │
│  │  7 years building..."     │ │ churn project at Stripe. │  │
│  │                           │ │                          │  │
│  │ ┌───────────────────────┐ │ │ Want to sharpen the      │  │
│  │ │ VARIANTS              │ │ │ differentiation, or try  │  │
│  │ │                       │ │ │ different constraint     │  │
│  │ │ 10s Elevator:         │ │ │ levels?                  │  │
│  │ │ "I turn churn into    │ │ │                          │  │
│  │ │  growth at scale."    │ │ │                          │  │
│  │ │                       │ │ │ You: Can we make it      │  │
│  │ │ 30s Networking:       │ │ │ more specific to the PM  │  │
│  │ │ "I'm a PM who..."    │ │ │ role?                    │  │
│  │ │                       │ │ │                          │  │
│  │ │ 60s TMAY:             │ │ │                          │  │
│  │ │ "Over the past 7..."  │ │ │                          │  │
│  │ │                       │ │ │                          │  │
│  │ │ 90s Interview:        │ │ │                          │  │
│  │ │ "Thanks for having    │ │ │                          │  │
│  │ │  me. I've spent..."   │ │ │                          │  │
│  │ │                       │ │ │                          │  │
│  │ │ LinkedIn Hook:        │ │ │                          │  │
│  │ │ "PM | Churn-to-..."   │ │ │ ┌──────────────────────┐ │  │
│  │ └───────────────────────┘ │ │ │ Type message...  [>] │ │  │
│  │                           │ │ └──────────────────────┘ │  │
│  └───────────────────────────┘ └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Left: Core positioning statement + 5 context variants (10s, 30s, 60s, 90s, LinkedIn hook).
- Right: Coach chat opens immediately with the generation rationale.
- Coach can run the constraint ladder, sharpen earned secrets, test differentiation.
- Variants are editable; coach suggestions have [ Apply ] buttons that update specific variants.

---

## 6. Outreach Page

### 6.1 Input

User selects a message type and provides target context. Locked until resume is uploaded.

### 6.2 Page States

**State 1 -- Locked (no resume)**

Same pattern as Pitch locked state, with "Go to Resume" CTA.

**State 2 -- Message Type Selection**

```
┌──────────────────────────────────────────────────────────────┐
│  Outreach                                                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Select a message type to draft:                       │  │
│  │                                                        │  │
│  │  ┌──────────────────┐  ┌──────────────────┐            │  │
│  │  │ Cold LinkedIn    │  │ Cold Email       │            │  │
│  │  │ Connection Req   │  │ (75-125 words)   │            │  │
│  │  │ (300 chars)      │  │                  │            │  │
│  │  └──────────────────┘  └──────────────────┘            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐            │  │
│  │  │ Warm Intro       │  │ Informational    │            │  │
│  │  │ Request          │  │ Interview Ask    │            │  │
│  │  └──────────────────┘  └──────────────────┘            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐            │  │
│  │  │ Recruiter Reply  │  │ Follow-Up        │            │  │
│  │  └──────────────────┘  └──────────────────┘            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐            │  │
│  │  │ Post-Meeting     │  │ Referral         │            │  │
│  │  │ Follow-Up        │  │ Request          │            │  │
│  │  └──────────────────┘  └──────────────────┘            │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**State 3 -- Draft + Coach (split pane)**

```
┌──────────────────────────────────────────────────────────────┐
│  Outreach > Cold LinkedIn          [ Back to message types ] │
│                                                              │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │ MESSAGE DRAFT (left)      │ │ COACH CHAT (right)       │  │
│  │                           │ │                          │  │
│  │ Type: Cold LinkedIn       │ │ Coach: Who are you       │  │
│  │ Limit: 300 chars          │ │ reaching out to? Give me │  │
│  │                           │ │ their name, role, and    │  │
│  │ ┌───────────────────────┐ │ │ company and I'll draft   │  │
│  │ │                       │ │ │ a personalized message.  │  │
│  │ │ "Hi Sarah -- your     │ │ │                          │  │
│  │ │  talk on retention    │ │ │ You: Sarah Chen, Head    │  │
│  │ │  metrics at SaaStr    │ │ │ of Product at Figma.     │  │
│  │ │  resonated. I led     │ │ │ I saw her talk at        │  │
│  │ │  a similar churn      │ │ │ SaaStr last month.       │  │
│  │ │  initiative at        │ │ │                          │  │
│  │ │  Stripe -- would love │ │ │ Coach: Here's a draft    │  │
│  │ │  to connect."         │ │ │ that leads with her      │  │
│  │ │                       │ │ │ talk and bridges to      │  │
│  │ │  247 / 300 chars      │ │ │ your experience...       │  │
│  │ │                       │ │ │                          │  │
│  │ └───────────────────────┘ │ │ [ Apply ]                │  │
│  │                           │ │                          │  │
│  │ [ Copy ] [ Edit ]         │ │ ┌──────────────────────┐ │  │
│  │                           │ │ │ Type message...  [>] │ │  │
│  └───────────────────────────┘ │ └──────────────────────┘ │  │
│                                └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 9 message types from the interview-coach-skill's outreach command.
- Coach asks for target context, then drafts a personalized message.
- Message draft displayed on the left with character count (platform-aware limits).
- [ Copy ] to clipboard, [ Edit ] for manual tweaks.
- Coach can generate follow-up sequences and alternative versions.

---

## 7. Dashboard Nudge

When no resume is uploaded, the Dashboard shows a prominent nudge card:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  [resume icon]  Upload your resume to unlock coaching      │
│                                                            │
│  Your resume powers story seeds, pitch generation,         │
│  outreach templates, and smarter mock interviews.          │
│                                                            │
│  [ Upload Resume ]                                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

This card disappears once a resume is uploaded and analyzed.

---

## 8. Data Model

### 8.1 Resume Tables

```sql
-- Core resume entity (one per user in general prep, one per job in workspaces)
CREATE TABLE resume (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    job_id UUID REFERENCES job(id),          -- null = master resume
    name TEXT NOT NULL,                       -- e.g. "Master Resume" or "Stripe PM Resume"
    original_file_name TEXT,
    raw_text TEXT,                            -- extracted text from upload
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One master resume per user, one resume per job
    UNIQUE (user_id) WHERE job_id IS NULL,
    UNIQUE (job_id) WHERE job_id IS NOT NULL
);

-- Parsed resume sections (the builder data)
CREATE TABLE resume_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,               -- summary | experience | education | skills | certifications
    sort_order INT NOT NULL DEFAULT 0,
    content JSONB NOT NULL,                   -- structured content per type (see below)
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI analysis of a resume (8 dimensions from interview-coach-skill)
CREATE TABLE resume_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    depth_level TEXT NOT NULL DEFAULT 'standard',  -- quick | standard | deep
    overall_grade TEXT,                        -- A / B / C / D
    ats_compatibility TEXT,                    -- ATS-Ready / ATS-Risky / ATS-Broken
    recruiter_scan TEXT,                       -- Strong / Moderate / Weak
    bullet_quality TEXT,                       -- Strong / Moderate / Weak
    seniority_calibration TEXT,               -- Aligned / Mismatched
    keyword_coverage TEXT,                    -- Strong / Moderate / Weak
    structure_layout TEXT,                    -- Strong / Moderate / Weak
    consistency_polish TEXT,                  -- Strong / Moderate / Weak
    concern_management TEXT,                  -- Strong / Moderate / Weak
    top_fixes JSONB,                          -- [{severity, dimension, description, fix}]
    concern_mitigations JSONB,               -- [{concern, mitigation_language}]
    positioning_strengths TEXT,
    likely_concerns TEXT,
    career_narrative_gaps TEXT,
    story_seeds JSONB,                        -- [{bullet_text, potential_story, section}]
    cross_surface_gaps JSONB,                -- [{surface_a, surface_b, gap, resolution}]
    created_at TIMESTAMPTZ DEFAULT now()
);

-- JD-targeted resume optimization (links resume to specific job)
CREATE TABLE jd_resume_optimization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
    keyword_gaps JSONB,                       -- [{keyword, present, location, action}]
    bullet_reordering JSONB,                 -- [{section, original_order, new_order, rationale}]
    skills_reordering JSONB,                 -- [ordered skill list for this JD]
    summary_adaptation TEXT,                  -- rewritten summary targeting this JD
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (resume_id, job_id)
);

-- Storybank-to-bullet pipeline
CREATE TABLE story_bullet_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES story(id) ON DELETE CASCADE,
    original_bullet TEXT,                     -- the existing resume bullet (nullable for new bullets)
    rewritten_bullet TEXT NOT NULL,           -- the AI-suggested rewrite
    target_section TEXT,                      -- which experience entry this maps to
    applied BOOLEAN NOT NULL DEFAULT false,   -- user accepted the suggestion
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Coach chat sessions per resume
CREATE TABLE resume_coach_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',    -- active | completed
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE resume_coach_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES resume_coach_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                        -- user | assistant
    content TEXT NOT NULL,
    suggested_edits JSONB,                   -- [{section_id, field, original, suggested, applied}]
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 8.2 Section Content JSONB Shapes

```
summary:
  { text: string }

experience:
  { company: string, title: string, start_date: string,
    end_date: string | null, location: string,
    bullets: string[] }

education:
  { institution: string, degree: string, field: string,
    graduation_date: string, gpa: string | null }

skills:
  { categories: [{ name: string, skills: string[] }] }

certifications:
  { items: [{ name: string, issuer: string, date: string }] }
```

### 8.3 Existing Tables (Unchanged)

These tables from the current schema remain as-is:

- `positioning_statement` -- stores pitch data (keyed on user_id)
- `linkedin_analysis` -- stores LinkedIn audit data (keyed on user_id)
- `comp_strategy` -- stores salary/negotiation data (keyed on user_id, future use)

### 8.4 Resume Context Resolution

```
Function: get_active_resume(user_id, workspace_context)

  IF workspace is "General Prep":
    RETURN master resume (job_id IS NULL)

  IF workspace is a Job Workspace:
    IF job-specific resume exists:
      RETURN job resume
    ELSE:
      RETURN master resume (fallback)
```

This resolution function is used by: mock interview, practice drills, pitch generation, outreach drafting, and story builder context.

---

## 9. API Endpoints

### Resume

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/resume/upload` | Upload PDF/DOCX, extract text, parse sections, run analysis |
| `GET` | `/api/resume` | Get active resume for current workspace (with sections + analysis) |
| `GET` | `/api/resume/:id` | Get specific resume by ID |
| `PUT` | `/api/resume/:id/sections/:sectionId` | Update a resume section (builder edits) |
| `POST` | `/api/resume/:id/reanalyze` | Re-run analysis after edits |
| `POST` | `/api/resume/:id/chat` | Send message to resume coach (SSE streaming) |
| `GET` | `/api/resume/:id/chat/session` | Get active coach session + messages |
| `POST` | `/api/resume/:id/chat/apply` | Apply a suggested edit to a section |

### LinkedIn

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/linkedin/audit` | Submit profile text, run 9-section audit |
| `GET` | `/api/linkedin` | Get existing LinkedIn analysis |
| `POST` | `/api/linkedin/chat` | Coach chat for LinkedIn refinement (SSE) |
| `GET` | `/api/linkedin/chat/session` | Get active session + messages |

### Pitch

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/pitch/generate` | Generate positioning statement from resume analysis |
| `GET` | `/api/pitch` | Get existing positioning statement + variants |
| `PUT` | `/api/pitch/variants/:type` | Update a specific variant |
| `POST` | `/api/pitch/chat` | Coach chat for pitch refinement (SSE) |
| `GET` | `/api/pitch/chat/session` | Get active session + messages |

### Outreach

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/outreach/draft` | Generate message draft (type + target context) |
| `GET` | `/api/outreach/drafts` | List saved drafts |
| `GET` | `/api/outreach/drafts/:id` | Get specific draft |
| `POST` | `/api/outreach/chat` | Coach chat for outreach refinement (SSE) |
| `GET` | `/api/outreach/chat/session` | Get active session + messages |

---

## 10. Interview-Coach-Skill Coverage

This maps which parts of the interview-coach-skill's resume command are covered by the design:

| Skill Feature | Covered | Where |
|---------------|---------|-------|
| 8-dimension audit (ATS, recruiter scan, bullet quality, seniority, keywords, structure, concerns, polish) | Yes | `resume_analysis` table, analysis card |
| Storybank-to-bullet pipeline | Yes | `story_bullet_mapping` table, coach chat Apply flow |
| JD-targeted optimization | Yes | `jd_resume_optimization` table (Job Workspace) |
| Cross-surface consistency (resume vs LinkedIn) | Yes | `cross_surface_gaps` in analysis, LinkedIn positioning gaps |
| Concern management with mitigation language | Yes | `concern_mitigations` in analysis |
| Depth levels (quick/standard/deep) | Yes | `depth_level` in analysis |
| Story seeds extraction | Yes | `story_seeds` in analysis, "Add to Storybank" buttons |
| Career transition detection | Future | Profile-level feature, not resume-specific |
| Challenge Protocol (Level 5 deep) | Future | Advanced coaching feature |
| Master resume strategy | Yes | Workspace-aware resume model (master + per-job) |
| Section-by-section rewrites | Yes | Coach chat with Apply buttons |

---

## 11. Implementation Sequence

Suggested build order (each step is independently shippable):

1. **Resume upload + analysis** -- Wire the existing backend upload endpoint to the frontend. Parse into sections. Display analysis card. This unblocks everything else.
2. **Resume builder** -- Editable sections on the left panel. CRUD for `resume_section`.
3. **Resume coach chat** -- SSE streaming chat in right panel with Apply flow.
4. **Dashboard nudge** -- Conditional card when no resume exists.
5. **Pitch page** -- Auto-generate from resume analysis. Coach chat for refinement.
6. **LinkedIn page** -- Profile text input. 9-section audit. Coach chat.
7. **Outreach page** -- Message type selection. Draft generation. Coach chat.
8. **Navigation restructure** -- Promote to BUILD group, retire /materials route.
9. **JD-targeted optimization** -- Job Workspace resume context (future).

Steps 1-4 form the MVP. Steps 5-7 can be built in parallel once the coach chat pattern is established.
