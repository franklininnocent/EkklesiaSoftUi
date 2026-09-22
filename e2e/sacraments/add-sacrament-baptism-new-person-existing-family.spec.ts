import { expect, test } from '@playwright/test';
import {
  SACRAMENT_E2E_BAPTISM,
  SACRAMENT_E2E_FAMILY,
} from '../fixtures/sacrament-e2e-data';
import { deleteSacrament } from '../helpers/api';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';
import { SacramentFormPage } from '../helpers/sacrament-form.page';

test.describe.configure({ mode: 'serial' });

test.describe('Add Sacrament — Baptism new person in existing family', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  let savedSacramentId: number | null = null;
  const uniqueDate = '2026-03-18';
  const babyFirst = 'E2E';
  const babyLast = 'NewbornBothParents';

  test.afterAll(async ({ browser }) => {
    if (!savedSacramentId) {
      return;
    }
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    await deleteSacrament(page, savedSacramentId);
    savedSacramentId = null;
    await context.close();
  });

  test('TC09 — Baptize newborn not yet in family member list', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);

    await form.openAddSacramentModal();
    await form.selectSacramentType(/baptism/i);
    await form.selectBaptismExistingFamily(SACRAMENT_E2E_FAMILY.bothParents.name);
    await form.selectBaptismNewPersonInExistingFamily({
      firstName: babyFirst,
      lastName: babyLast,
      relationship: 'daughter',
    });

    await page.locator('#recipient_birth_date').fill('2026-03-01');
    await page.locator('#recipient_gender').selectOption('female');
    await page.locator('#father_name').fill('E2E Father BothParents');
    await page.locator('#mother_name').fill('E2E Mother BothParents');

    await form.completeMinimumBaptismFields({
      date: uniqueDate,
      place: SACRAMENT_E2E_BAPTISM.placeAdministered,
      birthPlace: SACRAMENT_E2E_BAPTISM.birthPlace,
      ministerName: SACRAMENT_E2E_BAPTISM.ministerName,
      notes: `${SACRAMENT_E2E_BAPTISM.notesMarker}-new-person-${uniqueDate}`,
    });

    savedSacramentId = await form.save();
    await expect(page.getByText('Sacrament created successfully.')).toBeVisible();

    await context.close();
  });
});
