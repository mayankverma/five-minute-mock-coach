import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'verma.mayank+test1@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123456';

test.describe('StoryBuilder', () => {
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
      // Step 1: Name (may already be filled)
      const nameInput = page.locator('input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        const val = await nameInput.inputValue();
        if (!val) await nameInput.fill('Test User');
        await page.click('button:has-text("Next")');
      }

      // Step 2: Role + seniority
      const roleInput = page.locator('input[placeholder*="role" i], input[placeholder*="title" i]').first();
      if (await roleInput.isVisible().catch(() => false)) {
        const val = await roleInput.inputValue();
        if (!val) await roleInput.fill('Software Engineer');
      }
      // Click a seniority option if visible
      const seniorityBtn = page.locator('button:has-text("Senior"), button:has-text("Mid")').first();
      if (await seniorityBtn.isVisible().catch(() => false)) {
        await seniorityBtn.click();
      }
      const nextBtn = page.locator('button:has-text("Next")');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }

      // Step 3: Coaching style — click any option then finish
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

  test('opens StoryBuilder and shows coach opening message', async ({ page }) => {
    // Navigate to Storybank
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');

    // Click "Add Story" button
    const addBtn = page.locator('button:has-text("Add Story")').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // StoryBuilder should be visible with coach message
    const coachMsg = page.locator('.sb-msg.coach');
    await expect(coachMsg).toBeVisible({ timeout: 5_000 });
    // Coach should show one of the opening messages (varies per session)
    const coachText = await coachMsg.textContent();
    expect(coachText!.length).toBeGreaterThan(20);

    // Chat input should be visible
    const chatInput = page.locator('textarea[placeholder*="Tell me about"]');
    await expect(chatInput).toBeVisible();

    // "No stories yet" empty state should NOT be visible
    await expect(page.locator('text=No stories yet')).not.toBeVisible();
  });

  test('sends a message and receives streaming response', async ({ page }) => {
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');

    // Open StoryBuilder
    const addBtn = page.locator('button:has-text("Add Story")').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Wait for coach opening message
    await expect(page.locator('.sb-msg.coach')).toBeVisible({ timeout: 5_000 });

    // Type a message
    const chatInput = page.locator('textarea[placeholder*="Tell me about"]');
    await chatInput.fill('I led a migration from monolith to microservices at my last company');
    await page.click('.sb-send-btn');

    // User message should appear
    const userMsg = page.locator('.sb-msg.user');
    await expect(userMsg).toBeVisible({ timeout: 5_000 });
    await expect(userMsg).toContainText('migration');

    // Coach should respond (streaming — wait for second coach message)
    const coachMessages = page.locator('.sb-msg.coach');
    await expect(coachMessages).toHaveCount(2, { timeout: 30_000 });

    // Second coach message should have content (not empty)
    const secondCoach = coachMessages.nth(1);
    await expect(secondCoach).not.toHaveText('', { timeout: 30_000 });
  });

  test('story card panel is collapsible', async ({ page }) => {
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add Story")').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Card panel should exist (collapsed by default for new stories)
    const cardPanel = page.locator('.sb-card-panel');
    await expect(cardPanel).toBeVisible({ timeout: 5_000 });

    // Expand button should work
    const expandBtn = page.locator('.sb-expand-btn');
    await expandBtn.click();

    // Card body fields should be visible when expanded
    const titleInput = page.locator('.sb-card-body input').first();
    await expect(titleInput).toBeVisible();
  });

  test('close button returns to storybank', async ({ page }) => {
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add Story")').first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // StoryBuilder should be visible
    await expect(page.locator('.sb-msg.coach')).toBeVisible({ timeout: 5_000 });

    // Click Close
    await page.click('button:has-text("Close")');

    // StoryBuilder should be gone
    await expect(page.locator('.sb-msg.coach')).not.toBeVisible();
  });
});
