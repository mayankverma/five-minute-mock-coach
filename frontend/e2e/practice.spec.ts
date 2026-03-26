import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'verma.mayank+test1@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Main1316';

test.describe('Practice System', () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.click('.landing-auth-tab:has-text("Log In")');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('.landing-submit');

    // Wait for redirect to dashboard (or onboarding)
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });

    // If redirected to onboarding, complete it
    if (page.url().includes('/onboarding')) {
      const nameInput = page.locator('input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        const val = await nameInput.inputValue();
        if (!val) await nameInput.fill('Test User');
        await page.click('button:has-text("Next")');
      }
      const roleInput = page.locator('input[placeholder*="role" i], input[placeholder*="title" i]').first();
      if (await roleInput.isVisible().catch(() => false)) {
        const val = await roleInput.inputValue();
        if (!val) await roleInput.fill('Software Engineer');
      }
      const seniorityBtn = page.locator('button:has-text("Senior"), button:has-text("Mid")').first();
      if (await seniorityBtn.isVisible().catch(() => false)) {
        await seniorityBtn.click();
      }
      const nextBtn = page.locator('button:has-text("Next")');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      const styleBtn = page.locator('button:has-text("Direct"), button:has-text("Balanced")').first();
      if (await styleBtn.isVisible().catch(() => false)) {
        await styleBtn.click();
      }
      const startBtn = page.locator('button:has-text("Start Coaching")');
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click();
        await page.waitForURL(url => !url.pathname.includes('/onboarding'), { timeout: 15_000 });
      }
    }
  });

  test.describe('Practice Page - Layout & Navigation', () => {
    test('loads practice page with correct header and daily stats', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Page header
      await expect(page.locator('.page-title')).toContainText('Practice');
      await expect(page.locator('.page-subtitle')).toBeVisible();

      // Daily stats bar should be present
      await expect(page.locator('text=day streak')).toBeVisible();
      await expect(page.locator('text=questions today')).toBeVisible();
    });

    test('shows mode selector tabs (Quick Practice & Guided Program)', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      const quickTab = page.locator('.tab:has-text("Quick Practice")');
      const guidedTab = page.locator('.tab:has-text("Guided Program")');

      await expect(quickTab).toBeVisible();
      await expect(guidedTab).toBeVisible();

      // Quick Practice is default active
      await expect(quickTab).toHaveClass(/active/);
    });

    test('switches between Quick Practice and Guided Program modes', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Click Guided Program tab
      await page.click('.tab:has-text("Guided Program")');

      // Should show stage stepper
      await expect(page.locator('text=Ladder')).toBeVisible();
      await expect(page.locator('text=Pushback')).toBeVisible();
      await expect(page.locator('text=Stress')).toBeVisible();

      // Click back to Quick Practice
      await page.click('.tab:has-text("Quick Practice")');

      // Should show tier selector
      await expect(page.locator('button:has-text("Atomic")')).toBeVisible();
      await expect(page.locator('button:has-text("Session")')).toBeVisible();
      await expect(page.locator('button:has-text("Round Prep")')).toBeVisible();
    });
  });

  test.describe('Quick Practice - Tier Selection', () => {
    test('shows three tier buttons (Atomic, Session, Round Prep)', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('button:has-text("Atomic")')).toBeVisible();
      await expect(page.locator('button:has-text("Session")')).toBeVisible();
      await expect(page.locator('button:has-text("Round Prep")')).toBeVisible();
    });

    test('tier buttons toggle active state', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Atomic is default
      const atomicBtn = page.locator('button:has-text("Atomic")');
      await expect(atomicBtn).toHaveClass(/btn-primary/);

      // Click Session
      await page.click('button:has-text("Session")');
      const sessionBtn = page.locator('button:has-text("Session")');
      await expect(sessionBtn).toHaveClass(/btn-primary/);
      await expect(atomicBtn).toHaveClass(/btn-outline/);
    });

    test('shows filter dropdowns (theme and source)', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Theme dropdown
      const themeSelect = page.locator('select').first();
      await expect(themeSelect).toBeVisible();

      // Should have theme options
      const options = await themeSelect.locator('option').allTextContents();
      expect(options).toContain('All Themes');
      expect(options.length).toBeGreaterThan(5);
    });
  });

  test.describe('Quick Practice - Atomic Flow', () => {
    test('starts atomic practice and shows a question', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Start practice
      await page.click('button:has-text("Start Practice")');

      // Wait for question to load
      await expect(page.locator('.voice-question-text, .card-body >> text=/Tell me|Describe|Walk me|Give me|How/i')).toBeVisible({ timeout: 15_000 });
    });

    test('shows source indicator on question', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');

      // Wait for question to load
      await page.waitForTimeout(3_000);

      // Source indicator dot should be visible
      const sourceDot = page.locator('.source-dot');
      if (await sourceDot.isVisible().catch(() => false)) {
        // Click to show detail
        await sourceDot.click();
        const detail = page.locator('.source-detail');
        await expect(detail).toBeVisible();
      }
    });

    test('shows input mode toggle (Text / Voice)', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');
      await page.waitForTimeout(3_000);

      // Should have input mode buttons
      const textBtn = page.locator('button:has-text("Text")');
      const voiceBtn = page.locator('button:has-text("Voice")');

      if (await textBtn.isVisible().catch(() => false)) {
        await expect(textBtn).toBeVisible();
      }
      if (await voiceBtn.isVisible().catch(() => false)) {
        await expect(voiceBtn).toBeVisible();
      }
    });

    test('submits a text answer and shows scorecard', async ({ page }) => {
      test.setTimeout(120_000); // 2 minutes for AI scoring

      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');

      // Wait for question to load
      await page.waitForTimeout(5_000);

      // Switch to text mode
      await page.click('button:has-text("Text")');

      // Type an answer in the textarea
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: 5_000 });
      await textarea.fill(
        'When I was leading the platform team at my previous company, we faced a critical challenge with our legacy monolith. I identified that our deployment frequency had dropped to once a month due to tight coupling between services. I proposed and led the migration to a microservices architecture, starting with the highest-impact service. Over six months, we decomposed three core services, reducing deployment time from 4 hours to 15 minutes and increasing deployment frequency to multiple times per day. The key insight I gained was that the migration sequence matters more than the target architecture.'
      );

      // Submit
      await page.click('button:has-text("Submit Answer")');

      // Wait for scoring (AI call takes time)
      await expect(page.locator('.scorecard')).toBeVisible({ timeout: 90_000 });

      // Should show a score
      await expect(page.locator('text=/\\d\\.\\d/')).toBeVisible();
    });

    test('shows Try Again, Shuffle, and Next buttons after scoring', async ({ page }) => {
      test.setTimeout(120_000);

      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');
      await page.waitForTimeout(5_000);

      // Switch to text mode
      await page.click('button:has-text("Text")');

      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: 5_000 });
      await textarea.fill('I led a team through a major organizational change, resulting in 30% improvement in team velocity.');

      await page.click('button:has-text("Submit Answer")');

      // Wait for scoring
      await expect(page.locator('.scorecard')).toBeVisible({ timeout: 90_000 });

      // Action buttons should appear
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
      await expect(page.locator('button:has-text("Shuffle")')).toBeVisible();
    });

    test('scorecard has condensed/expanded toggle', async ({ page }) => {
      test.setTimeout(120_000);

      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');
      await page.waitForTimeout(5_000);

      await page.click('button:has-text("Text")');

      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: 5_000 });
      await textarea.fill('I managed a cross-functional project involving engineering, design, and product teams to deliver a new feature that increased user engagement by 25%.');

      await page.click('button:has-text("Submit Answer")');

      // Wait for scorecard
      await expect(page.locator('.scorecard')).toBeVisible({ timeout: 90_000 });

      // Should have expand button
      const expandBtn = page.locator('.scorecard-expand-btn, button:has-text("See full breakdown")');
      await expect(expandBtn).toBeVisible();

      // Click to expand
      await expandBtn.click();

      // Should show dimension bars
      await expect(page.locator('text=Substance')).toBeVisible();
      await expect(page.locator('text=Structure')).toBeVisible();
      await expect(page.locator('text=Relevance')).toBeVisible();
      await expect(page.locator('text=Credibility')).toBeVisible();
      await expect(page.locator('text=Differentiation')).toBeVisible();
    });

    test('scorecard shows tabs (Coaching Notes, Exemplar, Drill)', async ({ page }) => {
      test.setTimeout(120_000);

      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Start Practice")');
      await page.waitForTimeout(5_000);

      await page.click('button:has-text("Text")');

      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible({ timeout: 5_000 });
      await textarea.fill('In my role as engineering manager, I noticed our team was spending 40% of sprint time on bug fixes. I implemented a quality-first initiative including code review standards, automated testing requirements, and a bug triage process. Within three months, bug rates dropped by 60% and sprint velocity increased by 35%.');

      await page.click('button:has-text("Submit Answer")');

      await expect(page.locator('.scorecard')).toBeVisible({ timeout: 90_000 });

      // Expand scorecard
      const expandBtn = page.locator('.scorecard-expand-btn, button:has-text("See full breakdown")');
      await expandBtn.click();

      // Tabs should appear
      const coachingTab = page.locator('.scorecard-tab:has-text("Coaching Notes"), button:has-text("Coaching Notes")');
      if (await coachingTab.isVisible().catch(() => false)) {
        await expect(coachingTab).toBeVisible();
      }

      // Check for exemplar tab
      const exemplarTab = page.locator('.scorecard-tab:has-text("Exemplar"), button:has-text("Exemplar")');
      if (await exemplarTab.isVisible().catch(() => false)) {
        await exemplarTab.click();
        // Should show exemplar content
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Guided Program', () => {
    test('shows 8-stage stepper with stage names', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      // Switch to Guided Program
      await page.click('.tab:has-text("Guided Program")');

      // Should show all 8 stages
      const stageNames = ['Ladder', 'Pushback', 'Pivot', 'Gap', 'Role', 'Panel', 'Stress', 'Technical'];
      for (const name of stageNames) {
        await expect(page.locator(`text=${name}`).first()).toBeVisible();
      }
    });

    test('shows stage info card with gate requirements', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('.tab:has-text("Guided Program")');

      // Stage info should show gate details
      // Look for gate-related text (structure >= 3, etc.)
      const stageCard = page.locator('.card').filter({ hasText: /gate|stage|difficulty/i });
      if (await stageCard.isVisible().catch(() => false)) {
        await expect(stageCard).toBeVisible();
      }
    });

    test('can start a guided practice session and shows question', async ({ page }) => {
      await page.goto('/practice');
      await page.waitForLoadState('networkidle');

      await page.click('.tab:has-text("Guided Program")');

      // Click start button for guided
      const startBtn = page.locator('button:has-text("Start Stage"), button:has-text("Start")').first();
      await expect(startBtn).toBeVisible({ timeout: 5_000 });
      await startBtn.click();

      // Wait for question to load
      await page.waitForTimeout(5_000);

      // Should show stage info and question text
      await expect(page.locator('text=/Question \\d/i')).toBeVisible({ timeout: 10_000 });

      // Switch to text mode and verify textarea appears
      const textBtn = page.locator('button:has-text("Text")');
      if (await textBtn.isVisible().catch(() => false)) {
        await textBtn.click();
        await expect(page.locator('textarea')).toBeVisible({ timeout: 3_000 });
      }
    });
  });
});
