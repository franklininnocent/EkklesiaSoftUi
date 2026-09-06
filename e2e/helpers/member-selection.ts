import { expect, Locator, Page } from '@playwright/test';
import { SacramentE2eMemberFixture } from '../fixtures/sacrament-e2e-data';
import { waitForMemberSearchResponse } from './api';

const BRIDE_FIELD_ID = 'bride';

export function brideMemberSearch(page: Page): Locator {
  return page.getByTestId(`member-search-${BRIDE_FIELD_ID}`);
}

export function brideSelectedMemberBlock(page: Page): Locator {
  return page.getByTestId('selected-member').first();
}

export function brideIdentityBlock(page: Page): Locator {
  return page.locator('app-participant-source-control').filter({ has: page.getByTestId(`member-search-${BRIDE_FIELD_ID}`) }).or(
    page.locator('app-participant-source-control').filter({ hasText: 'Bride' }).first()
  );
}

export async function searchAndSelectBrideMember(
  page: Page,
  member: SacramentE2eMemberFixture
): Promise<void> {
  const search = brideMemberSearch(page);
  await expect(search).toBeVisible();

  const responsePromise = waitForMemberSearchResponse(page, member.searchName);
  await search.fill(member.searchName);
  const response = await responsePromise;
  const body = await response.json();
  const rows = body?.data ?? [];
  const match = rows.find((row: { full_name?: string; first_name?: string; last_name?: string }) => {
    const fullName = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
    return fullName.includes(member.searchName) || fullName.includes(member.lastName);
  });
  expect(match, 'Member search API should return the expected fixture member').toBeTruthy();

  await page.getByRole('option', { name: new RegExp(member.searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  await expect(page.getByTestId('selected-member').first()).toContainText(member.searchName);
}

export async function changeBrideMember(page: Page): Promise<void> {
  await page.getByTestId('change-member').first().click();
  await expect(brideMemberSearch(page)).toBeVisible();
}

export async function assertBrideMemberProfile(
  page: Page,
  member: SacramentE2eMemberFixture
): Promise<void> {
  const section = page.locator('#sacrament-section-bride');
  await expect(section.getByTestId('member-dob')).toContainText(member.dobDisplay);
  if (member.genderDisplay) {
    await expect(section.getByTestId('member-gender')).toContainText(member.genderDisplay);
  }
  await expect(section.getByTestId('member-father-name')).toContainText(member.fatherDisplay);
  await expect(section.getByTestId('member-mother-name')).toContainText(member.motherDisplay);
}

export async function assertMemberProfileNotVisible(
  page: Page,
  member: SacramentE2eMemberFixture
): Promise<void> {
  const section = page.locator('#sacrament-section-bride');
  await expect(section).not.toContainText(member.dobDisplay);
  if (member.father) {
    await expect(section).not.toContainText(member.father);
  }
  if (member.mother) {
    await expect(section).not.toContainText(member.mother);
  }
}
