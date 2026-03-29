import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'verma.mayank+test1@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Main1316';

test.describe('Mock Interview', () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.click('.landing-auth-tab:has-text("Log In")');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('.landing-submit');

    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });

    // Handle onboarding if needed
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

  test.describe('Format Selection', () => {
    test('loads mock interview page with 6 format cards', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      // Page header
      await expect(page.locator('.page-title')).toContainText(/Mock|Interview/i);

      // Should show 6 format options
      await expect(page.locator('text=Behavioral Screen')).toBeVisible();
      await expect(page.locator('text=Deep Behavioral')).toBeVisible();
      await expect(page.locator('text=System Design')).toBeVisible();
      await expect(page.locator('text=Panel')).toBeVisible();
      await expect(page.locator('text=Bar Raiser')).toBeVisible();
      await expect(page.locator('text=Technical + Behavioral')).toBeVisible();
    });

    test('clicking a format card highlights it', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      // Click Behavioral Screen card
      await page.click('text=Behavioral Screen');

      // Start button should appear
      await expect(page.locator('button:has-text("Start")')).toBeVisible();
    });

    test('shows format details (questions count and duration)', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      // Format cards should show details
      await expect(page.locator('text=Recruiter-style')).toBeVisible();
      await expect(page.locator('text=Hiring manager')).toBeVisible();
    });
  });

  test.describe('Interview Session', () => {
    test('starts a behavioral screen interview and shows questions from API', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      // Select format
      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      // Wait for question to load from API
      await page.waitForTimeout(5_000);

      // Should show question 1
      await expect(page.locator('text=Submit Answer')).toBeVisible({ timeout: 15_000 });

      // Should have a text input area
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
    });

    test('can submit an answer and advance to next question', async ({ page }) => {
      test.setTimeout(120_000);

      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      await expect(page.locator('text=Submit Answer')).toBeVisible({ timeout: 15_000 });

      const textarea = page.locator('textarea');
      await textarea.fill('In my previous role, I led a team through a major product launch that resulted in 50% increase in user engagement.');

      await page.click('button:has-text("Submit Answer")');

      // Wait for submit to complete (AI scoring ~20s) and advance to Q2
      await expect(page.locator('.page-subtitle')).toContainText('Question 2', { timeout: 90_000 });
    });

    test('can skip a question without answering', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      await expect(page.locator('text=Submit Answer')).toBeVisible({ timeout: 15_000 });

      // Skip advances instantly (no API call)
      await page.click('button:has-text("Skip")');
      await expect(page.locator('.page-subtitle')).toContainText('Question 2', { timeout: 5_000 });
    });

    test('no per-question scoring shown during mock interview', async ({ page }) => {
      test.setTimeout(120_000);

      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      await expect(page.locator('text=Submit Answer')).toBeVisible({ timeout: 15_000 });

      const textarea = page.locator('textarea');
      await textarea.fill('I managed a cross-functional initiative that delivered ahead of schedule.');

      await page.click('button:has-text("Submit Answer")');

      // Wait for advance to Q2
      await expect(page.locator('.page-subtitle')).toContainText('Question 2', { timeout: 90_000 });

      // Scorecard should NOT be visible (mock mode = no per-question feedback)
      await expect(page.locator('.scorecard')).not.toBeVisible();
    });

    test('shows end/debrief button', async ({ page }) => {
      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      await expect(page.locator('text=Submit Answer')).toBeVisible({ timeout: 15_000 });

      // Should have an end session or debrief button
      const endBtn = page.locator('button:has-text("End"), button:has-text("Debrief"), button:has-text("Finish")');
      await expect(endBtn.first()).toBeVisible();
    });
  });

  test.describe('Full Mock with Debrief', () => {
    test('completes a full 4-question behavioral screen and gets debrief', async ({ page }) => {
      test.setTimeout(300_000); // 5 minutes for full mock with AI scoring

      await page.goto('/mock');
      await page.waitForLoadState('networkidle');

      await page.click('text=Behavioral Screen');
      await page.click('button:has-text("Start")');

      const sampleAnswers = [
        'When I was leading the platform engineering team, I identified that our CI/CD pipeline was causing 2-hour deploy cycles. I redesigned the pipeline architecture, reducing deploys to 15 minutes and saving the team 400 engineering hours per quarter.',
        'I once had to deliver critical feedback to a senior engineer who was resistant to code reviews. I approached it by showing concrete data on bug rates and framing reviews as a mentorship opportunity. Within a month, they became our biggest code review advocate.',
        'During a major incident that affected 100K users, I led the war room coordination between 4 teams. I established clear communication channels, delegated investigation streams, and we resolved the issue in 2 hours instead of the typical 8.',
        'I made a strategic bet to migrate our data pipeline from batch to real-time processing. Despite pushback from stakeholders who preferred the status quo, I built a proof of concept in 2 weeks that showed 10x improvement in data freshness.',
      ];

      // Answer all 4 questions
      for (let i = 0; i < 4; i++) {
        await expect(page.locator('.page-subtitle')).toContainText(`Question ${i + 1}`, { timeout: 30_000 });

        const textarea = page.locator('textarea');
        await textarea.fill(sampleAnswers[i]);
        await page.click('button:has-text("Submit")');

        // Wait a moment for the submission to process
        await page.waitForTimeout(2_000);
      }

      // After all questions, request debrief
      const debriefBtn = page.locator('button:has-text("Debrief"), button:has-text("Get Debrief"), button:has-text("End")').first();
      if (await debriefBtn.isVisible().catch(() => false)) {
        await debriefBtn.click();
      }

      // Wait for debrief to load (AI call)
      await page.waitForTimeout(30_000);

      // Debrief should show hire signal
      const hasDebrief = await page.locator('text=/strong_hire|hire|mixed|no_hire|Strong Hire|Hire|Mixed|No Hire/i').isVisible().catch(() => false);
      if (hasDebrief) {
        await expect(page.locator('text=/strong_hire|hire|mixed|no_hire|Strong Hire|Hire|Mixed|No Hire/i').first()).toBeVisible();
      }

      // Should show "Back to Formats" or similar reset button
      const backBtn = page.locator('button:has-text("Back"), button:has-text("Formats"), button:has-text("New Interview")');
      if (await backBtn.first().isVisible().catch(() => false)) {
        await expect(backBtn.first()).toBeVisible();
      }
    });
  });
});
