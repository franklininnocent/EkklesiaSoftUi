import { expect, test } from '@playwright/test';
import { SACRAMENT_E2E_MEMBERS } from '../fixtures/sacrament-e2e-data';
import { waitForMemberSearchResponse } from '../helpers/api';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';
import {
  assertBrideMemberProfile,
  assertMemberProfileNotVisible,
  changeBrideMember,
  searchAndSelectBrideMember,
} from '../helpers/member-selection';
import { SacramentFormPage } from '../helpers/sacrament-form.page';

test.describe('Add Sacrament — Marriage parish member profile', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  test('TC01 — Select parish member', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const member = SACRAMENT_E2E_MEMBERS.bothParents;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');

    const search = page.getByTestId('member-search-bride');
    const responsePromise = waitForMemberSearchResponse(page, member.searchName);
    await search.fill(member.searchName);
    const response = await responsePromise;
    const body = await response.json();
    const match = (body.data ?? []).find((row: { full_name?: string }) =>
      (row.full_name || '').includes(member.searchName)
    );
    expect(match).toBeTruthy();
    expect(match.date_of_birth).toContain('2003-09-27');
    expect(match.gender).toBe('female');
    expect(match.father_name).toBe(member.father);
    expect(match.mother_name).toBe(member.mother);

    await page.getByRole('option', { name: new RegExp(member.searchName) }).click();
    await assertBrideMemberProfile(page, member);

    await context.close();
  });

  test('TC02 — Change parish member', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const memberA = SACRAMENT_E2E_MEMBERS.memberA;
    const memberB = SACRAMENT_E2E_MEMBERS.memberB;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');

    await searchAndSelectBrideMember(page, memberA);
    await assertBrideMemberProfile(page, memberA);

    await changeBrideMember(page);
    await searchAndSelectBrideMember(page, memberB);
    await assertBrideMemberProfile(page, memberB);
    await assertMemberProfileNotVisible(page, memberA);

    await context.close();
  });

  test('TC03 — Missing father', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const member = SACRAMENT_E2E_MEMBERS.fatherOnly;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');
    await searchAndSelectBrideMember(page, member);
    await assertBrideMemberProfile(page, member);

    await context.close();
  });

  test('TC04 — Missing mother', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const member = SACRAMENT_E2E_MEMBERS.motherOnly;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');
    await searchAndSelectBrideMember(page, member);
    await assertBrideMemberProfile(page, member);

    await context.close();
  });

  test('TC05 — Missing both parents', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);
    const member = SACRAMENT_E2E_MEMBERS.noParents;

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);
    await form.selectMarriageBrideSource('member');
    await searchAndSelectBrideMember(page, member);
    await assertBrideMemberProfile(page, member);
    await expect(page.locator('#sacrament-section-bride').getByTestId('member-gender')).toContainText(
      member.genderDisplay
    );

    await context.close();
  });

  test('TC06 — Non-member workflow', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const form = new SacramentFormPage(page);

    await form.openAddSacramentModal();
    await form.selectSacramentType(/marriage|matrimony/i);

    await form.selectMarriageBrideSource('external');
    await form.fillExternalParticipant('bride', {
      name: 'E2E External Bride',
      dob: '1990-05-10',
      gender: 'female',
    });

    await form.selectMarriageGroomSource('external');
    await form.fillExternalParticipant('groom', {
      name: 'E2E External Groom',
      dob: '1988-12-01',
      gender: 'male',
    });

    await form.completeMinimumMarriageFields();

    const brideSection = page.locator('#sacrament-section-bride');
    await expect(brideSection.locator('#ext_name_bride')).toBeEditable();
    await expect(brideSection.locator('#ext_dob_bride')).toBeEditable();
    await expect(brideSection.locator('#ext_gender_bride')).toBeEditable();
    await expect(brideSection.getByTestId('member-father-name')).toHaveCount(0);
    await expect(brideSection.getByTestId('member-mother-name')).toHaveCount(0);
    await expect(page.getByTestId('save-sacrament')).toBeEnabled();

    await context.close();
  });
});
