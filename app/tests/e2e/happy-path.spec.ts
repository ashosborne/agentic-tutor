import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Agentic Tutor happy path', () => {
  test('home shows children and can generate + assess in demo mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Whose learning adventure/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Maya/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Leo/i })).toBeVisible();

    await page.getByRole('button', { name: /Maya/i }).click();
    await expect(page.getByText(/Maya is growing/i)).toBeVisible();
    await expect(page.getByLabel(/Learning progress/i)).toBeVisible();
    await expect(page.getByText(/Needs learning/i).first()).toBeVisible();
    await expect(page.getByText(/Next focus:/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue with the tutor/i })).toBeVisible();

    await page.getByRole('link', { name: /Create worksheet \(advanced\)/i }).click();
    await expect(page.getByRole('heading', { name: /Pick a theme/i })).toBeVisible();

    await page.getByPlaceholder(/sea life/i).fill('sea life');
    await page.getByRole('button', { name: /^20 minutes$/i }).click();
    await page.getByRole('button', { name: /Create worksheet/i }).click();

    await expect(page.getByText(/Ready to print/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: /View \/ print|Download/i })).toBeVisible();

    await page.getByRole('button', { name: /Upload scan when done/i }).click();
    await expect(page.getByText(/Upload scan/i)).toBeVisible();

    const fixtureScan = path.resolve(__dirname, '../../fixtures/scans/demo-scan-sea-life.svg');
    await page.setInputFiles('input[type="file"]', fixtureScan);

    await expect(page.getByRole('heading', { name: /How it went/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Maya/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tell us how it felt/i })).toBeVisible();

    await page.getByRole('link', { name: /View progress/i }).click();
    await expect(page.getByRole('heading', { name: /The curriculum, curated/i })).toBeVisible();
    await expect(page.getByLabel(/Progress atlas/i)).toBeVisible();
    await expect(page.getByLabel(/Subject overview/i)).toBeVisible();
    await expect(
      page.locator('.subject-card').filter({ hasText: 'Mathematics' }),
    ).toBeVisible();
  });

  test('guided tutor lesson → upload → how-it-went → insights', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Maya/i }).click();
    await page.getByRole('link', { name: /Continue with the tutor/i }).click();
    await expect(page.getByText(/Today’s lesson for Maya/i)).toBeVisible();
    await expect(page.getByText(/gentle experiment|Clear goals/i).first()).toBeVisible();

    await page.getByPlaceholder(/unicorns|sea life|space/i).fill('sea life');
    await page.getByRole('button', { name: /Create today’s worksheet/i }).click();
    await expect(page.getByText(/Ready to print/i)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /Upload scan when done/i }).click();
    const fixtureScan = path.resolve(__dirname, '../../fixtures/scans/demo-scan-sea-life.svg');
    await page.setInputFiles('input[type="file"]', fixtureScan);
    await expect(page.getByRole('heading', { name: /How it went/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /Tell us how it felt/i }).click();
    await expect(page.getByText(/Did they finish the main part/i)).toBeVisible();
    await page.getByRole('button', { name: /^Yes$/i }).click();
    await page.getByRole('button', { name: /^😄$/i }).click();
    await page.getByRole('button', { name: /^Easy$/i }).click();
    await page.getByRole('button', { name: /Save how it went/i }).click();

    await expect(page.getByText(/What we’re learning about Maya|Here’s what we’ll try next/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('link', { name: /See insights/i }).click();
    await expect(page.getByRole('heading', { name: /What seems to help Maya/i })).toBeVisible();
    await expect(page.getByText(/Clear goals|Still learning|What we’re trying/i).first()).toBeVisible();
  });

  test('atlas and scorecards open full-width subject workspace', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Leo/i }).click();
    await page.getByRole('link', { name: /Explore learning path/i }).click();

    await expect(page.getByLabel(/Progress atlas/i)).toBeVisible();
    await expect(page.getByText(/Progress atlas/i).first()).toBeVisible();

    await page
      .locator('.subject-card')
      .filter({ hasText: 'Mathematics' })
      .click();

    await expect(page.getByLabel(/Mathematics learning path/i)).toBeVisible();
    await expect(page.locator('.subject-workspace')).toBeVisible();
    await expect(page.locator('.chapter-rail-item').first()).toBeVisible();
    await expect(page.locator('.chapter-link-map')).toBeVisible();
    await expect(page.locator('.journey-step').first()).toBeVisible();

    await page.locator('.journey-step').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Close topic details/i }).click();

    await page.getByRole('button', { name: /Overview/i }).first().click();
    await expect(page.getByLabel(/Progress atlas/i)).toBeVisible();
    await expect(page.getByLabel(/Mathematics learning path/i)).toHaveCount(0);
  });

  test('topic drawer prefills concept focus on generate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Leo/i }).click();
    await page.getByRole('link', { name: /Explore learning path/i }).click();

    await page
      .locator('.subject-card')
      .filter({ hasText: 'English' })
      .click();

    await expect(page.getByLabel(/English learning path/i)).toBeVisible();
    const chapter = page.locator('.chapter-rail-item.active');
    await expect(chapter).toBeVisible();
    const domainName = (await chapter.locator('.chapter-rail-title').textContent())?.trim();
    expect(domainName).toBeTruthy();

    await page.locator('.journey-step').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const topicName = (await dialog.locator('h2').textContent())?.trim();
    expect(topicName).toBeTruthy();

    await dialog.getByRole('link', { name: /Create worksheet/i }).click();
    await expect(page.getByRole('heading', { name: /Pick a theme/i })).toBeVisible();

    const focus = page.getByRole('group', { name: /Concept focus/i });
    await expect(focus).toBeVisible();
    await expect(focus.getByText(topicName!)).toBeVisible();
    await expect(focus.getByText(`English · ${domainName}`)).toBeVisible();
    await expect(page.getByLabel(/^Subject/i)).toHaveCount(0);
    await expect(page.getByLabel(/^Area/i)).toHaveCount(0);
  });

  test('settings can toggle demo mode', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Household setup/i })).toBeVisible();
    await page.getByRole('button', { name: /Use demo data/i }).click();
    await expect(page.getByText(/Demo mode on/i)).toBeVisible();
  });

  test('settings can add and remove a child with DOB', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Household setup/i })).toBeVisible();

    await page.getByLabel(/^Name$/i).last().fill('Sam');
    await page.getByLabel(/Date of birth/i).last().fill('2020-03-15');
    await expect(page.getByText(/Age 6 · Year 1/i).last()).toBeVisible();
    await page.getByRole('button', { name: /Add child/i }).click();
    await expect(page.getByText(/Child added/i)).toBeVisible();
    await expect(page.getByText('Sam').first()).toBeVisible();
    await expect(page.getByText(/Age 6 · Year 1/i).first()).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('button', { name: /Sam/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sam/i })).toContainText('Year 1');

    await page.goto('/settings');
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .locator('.list-item')
      .filter({ hasText: 'Sam' })
      .getByRole('button', { name: /Remove/i })
      .click();
    await expect(page.getByText(/Sam removed/i)).toBeVisible();
  });
});
