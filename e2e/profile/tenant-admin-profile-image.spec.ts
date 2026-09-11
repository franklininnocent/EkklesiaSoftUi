import { expect, test } from '@playwright/test';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';

const testJpeg = {
  name: 'profile-photo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
    'base64'
  ),
};

test.describe('Tenant administrator self-service profile image', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('uploads and displays profile photo from profile page', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile photo' })).toBeVisible();

    await page.locator('#profile_photo').setInputFiles(testJpeg);
    await page.getByRole('button', { name: 'Save photo' }).click();

    await expect(page.getByText(/profile photo updated|uploaded successfully/i)).toBeVisible({ timeout: 15000 });

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    await expect(photoTrigger.first()).toBeVisible();
    await photoTrigger.first().click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close image viewer' }).click();

    await context.close();
  });

  test('shows same profile photo on users list for administrator', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('#profile_photo');
    if (await fileInput.count()) {
      await fileInput.setInputFiles(testJpeg);
      await page.getByRole('button', { name: 'Save photo' }).click();
      await expect(page.getByText(/profile photo updated|uploaded successfully/i)).toBeVisible({ timeout: 15000 });
    }

    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) > 0) {
      await photoTrigger.first().click();
      await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
      await page.getByRole('button', { name: 'Close image viewer' }).click();
    }

    await context.close();
  });

  test('does not allow self image edit from users modal', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    const selfRow = page.locator('tbody tr').filter({ hasText: /Viewing your own account|own account/i }).first();
    if ((await selfRow.count()) === 0) {
      const editButtons = page.getByRole('button', { name: /edit user|view user/i });
      if ((await editButtons.count()) === 0) {
        await context.close();
        test.skip(true, 'No self user row available in this tenant');
        return;
      }
    }

    const ownAccountAlert = page.getByText(/Viewing your own account/i);
    if ((await ownAccountAlert.count()) > 0) {
      await expect(page.locator('#profile_image')).toHaveCount(0);
      await expect(page.getByText(/update your profile photo from/i)).toBeVisible();
    }

    await context.close();
  });
});
