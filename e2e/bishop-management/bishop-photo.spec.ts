import { expect, test } from '@playwright/test';
import {
  createPlatformAdminContext,
  skipWithoutPlatformAdmin,
} from '../helpers/auth-context';
import {
  fillValidBishopForm,
  openCreateBishopModal,
  submitCreateBishopModal,
} from '../helpers/bishop-create-modal.page';

test.describe('Bishop photo lifecycle', () => {
  test.skip(skipWithoutPlatformAdmin(), 'RBAC platform admin storage state not provided');

  test('should upload bishop photo during create and show avatar in list', async ({ browser }) => {
    const context = await createPlatformAdminContext(browser);
    const page = await context.newPage();
    const uniqueName = `E2E Photo Bishop ${Date.now()}`;

    await openCreateBishopModal(page);
    await fillValidBishopForm(page, uniqueName);

    const fileInput = page.locator('input[type="file"][aria-label="Upload bishop photo"]');
    await fileInput.setInputFiles({
      name: 'bishop-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
        'base64'
      ),
    });

    await submitCreateBishopModal(page);
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('app-bishop-avatar img').first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
