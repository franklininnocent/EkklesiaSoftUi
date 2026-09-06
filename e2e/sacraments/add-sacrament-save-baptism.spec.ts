import { expect, test } from '@playwright/test';
import {
  SACRAMENT_E2E_BAPTISM,
  SACRAMENT_E2E_FAMILY,
  SACRAMENT_E2E_MEMBERS,
} from '../fixtures/sacrament-e2e-data';
import {
  deleteSacrament,
  findRecipientSnapshot,
  waitForSacramentDetailResponse,
} from '../helpers/api';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';
import { SacramentFormPage } from '../helpers/sacrament-form.page';

test.describe.configure({ mode: 'serial' });

test.describe('Add Sacrament — Baptism save and snapshot', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  let savedSacramentId: number | null = null;
  let uniqueDate: string;

  test.beforeAll(() => {
    uniqueDate = `2026-02-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
  });

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

  test('TC07 — Save Baptism', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const member = SACRAMENT_E2E_MEMBERS.bothParents;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/baptism/i);
    await form.selectBaptismExistingFamily(SACRAMENT_E2E_FAMILY.bothParents.name);
    await form.selectBaptismRecipient(member.searchName);
    await form.assertBaptismRecipientProfile({
      dob: member.dob,
      gender: member.gender,
      father: member.father!,
      mother: member.mother!,
    });

    await form.completeMinimumBaptismFields({
      date: uniqueDate,
      place: SACRAMENT_E2E_BAPTISM.placeAdministered,
      birthPlace: SACRAMENT_E2E_BAPTISM.birthPlace,
      ministerName: SACRAMENT_E2E_BAPTISM.ministerName,
      notes: `${SACRAMENT_E2E_BAPTISM.notesMarker}-${uniqueDate}`,
    });

    savedSacramentId = await form.save();
    await expect(page.getByText('Sacrament created successfully.')).toBeVisible();
    await expect(page.getByRole('button', { name: member.searchName })).toBeVisible();

    await context.close();
  });

  test('TC08 — Historical snapshot', async ({ browser }) => {
    expect(savedSacramentId, 'TC07 must create a sacrament first').toBeTruthy();

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const member = SACRAMENT_E2E_MEMBERS.bothParents;

    await page.goto('/sacraments/register');
    await expect(page.getByRole('heading', { name: 'Parish Sacrament Register' })).toBeVisible();
    await page.getByPlaceholder(/Search by recipient/i).fill(member.searchName);
    await expect(page.getByRole('button', { name: member.searchName })).toBeVisible({ timeout: 15000 });

    const row = page.getByRole('row', { name: new RegExp(member.searchName) });
    await row.getByRole('button', { name: new RegExp(`Actions for ${member.searchName}`) }).click();
    const detailResponsePromise = savedSacramentId
      ? waitForSacramentDetailResponse(page, savedSacramentId)
      : null;
    await page.getByRole('menuitem', { name: 'View details' }).click();
    if (detailResponsePromise) {
      await detailResponsePromise;
    }

    await expect(page.getByTestId('sacrament-detail-dob')).toContainText(member.dobDisplay);
    await expect(page.getByTestId('sacrament-detail-gender')).toContainText(member.genderDisplay);
    await expect(page.getByTestId('sacrament-detail-father')).toContainText(member.father!);
    await expect(page.getByTestId('sacrament-detail-mother')).toContainText(member.mother!);
    await expect(page.getByTestId('sacrament-detail-participants')).toBeVisible();

    const apiResponse = await page.request.get(`/api/sacraments/${savedSacramentId}`);
    expect(apiResponse.ok()).toBeTruthy();
    const payload = await apiResponse.json();
    const recipient = findRecipientSnapshot(payload.data?.participants);
    expect(recipient?.snapshot_json?.full_name).toContain('E2E Olivia BothParents');
    expect(recipient?.snapshot_json?.date_of_birth).toContain('2003-09-27');
    expect(recipient?.snapshot_json?.gender).toBe('female');
    expect(recipient?.snapshot_json?.father_name).toBe(member.father);
    expect(recipient?.snapshot_json?.mother_name).toBe(member.mother);

    await context.close();
  });
});
