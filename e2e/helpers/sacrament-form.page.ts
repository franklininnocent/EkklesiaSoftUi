import { expect, Page } from '@playwright/test';
import { SACRAMENT_E2E_ENTRY_URL } from '../fixtures/sacrament-e2e-data';
import { waitForSacramentCreateResponse } from './api';

export class SacramentFormPage {
  constructor(private readonly page: Page) {}

  async openAddSacramentModal(): Promise<void> {
    await this.page.goto(SACRAMENT_E2E_ENTRY_URL);
    await expect(this.page.getByRole('heading', { name: 'Add Sacrament' })).toBeVisible();
    await expect(this.page.locator('#sacrament-modal-form')).toBeVisible({ timeout: 15000 });
  }

  async selectSacramentType(typeName: RegExp | string): Promise<void> {
    const select = this.page.getByTestId('sacrament-type');
    await expect(select).toBeVisible();
    await select.locator('.ng-input input').click();
    await this.page.getByRole('option', { name: typeName }).click();
    await expect(this.page.locator('#date_administered')).toBeVisible();
  }

  async fillDateAdministered(value: string): Promise<void> {
    await this.page.locator('#date_administered').fill(value);
  }

  async fillPlaceAdministered(value: string): Promise<void> {
    await this.page.locator('#place_administered').fill(value);
  }

  async selectMarriageBrideSource(source: 'member' | 'external'): Promise<void> {
    const section = this.page.locator('#sacrament-section-bride');
    const label = source === 'member' ? 'Existing member' : 'External person';
    await section.getByRole('radio', { name: label }).check();
  }

  async selectMarriageGroomSource(source: 'member' | 'external'): Promise<void> {
    const section = this.page.locator('#sacrament-section-groom');
    const label = source === 'member' ? 'Existing member' : 'External person';
    await section.getByRole('radio', { name: label }).check();
  }

  async fillExternalParticipant(role: 'bride' | 'groom', data: {
    name: string;
    dob?: string;
    gender?: 'male' | 'female' | 'other';
  }): Promise<void> {
    const fieldId = role;
    await this.page.locator(`#ext_name_${fieldId}`).fill(data.name);
    if (data.dob) {
      await this.page.locator(`#ext_dob_${fieldId}`).fill(data.dob);
    }
    if (data.gender) {
      await this.page.locator(`#ext_gender_${fieldId}`).selectOption(data.gender);
    }
  }

  async completeMinimumMarriageFields(options?: {
    place?: string;
    date?: string;
    ministerName?: string;
  }): Promise<void> {
    await this.fillDateAdministered(options?.date || '2026-01-15');
    await this.fillPlaceAdministered(options?.place || 'E2E Test Parish');

    await this.page.getByLabel('External minister').check();
    await this.page.locator('#minister_ext_name_minister').fill(options?.ministerName || 'Rev. E2E Minister');
    await this.page.locator('#minister_ext_role_minister').selectOption({ index: 1 });
  }

  async selectBaptismExistingFamily(familyLabel: string): Promise<void> {
    await this.page.getByRole('radio', { name: 'Existing Family' }).check();
    const familySelect = this.page.getByTestId('family-select');
    await familySelect.locator('.ng-input input').click();
    await this.page.getByRole('option', { name: new RegExp(familyLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  }

  async selectBaptismRecipient(recipientLabel: string): Promise<void> {
    const recipientSelect = this.page.getByTestId('recipient-member-select');
    await expect(recipientSelect).toBeVisible();
    await recipientSelect.locator('.ng-input input').click();
    await this.page.getByRole('option', { name: new RegExp(recipientLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  }

  async assertBaptismRecipientProfile(expected: {
    dob: string;
    gender: string;
    father: string;
    mother: string;
  }): Promise<void> {
    await expect(this.page.getByTestId('recipient-dob')).toHaveValue(expected.dob);
    await expect(this.page.getByTestId('recipient-gender')).toHaveValue(expected.gender);
    await expect(this.page.locator('#selectedFatherId')).toContainText(expected.father);
    await expect(this.page.locator('#selectedMotherId')).toContainText(expected.mother);
  }

  async completeMinimumBaptismFields(options: {
    date: string;
    place: string;
    birthPlace: string;
    ministerName: string;
    notes?: string;
  }): Promise<void> {
    await this.fillDateAdministered(options.date);
    await this.fillPlaceAdministered(options.place);
    await this.page.locator('#recipient_birth_place').fill(options.birthPlace);

    await this.page.getByLabel('External minister').check();
    await this.page.locator('#minister_ext_name_minister').fill(options.ministerName);
    await this.page.locator('#minister_ext_role_minister').selectOption({ index: 1 });

    if (options.notes) {
      await this.page.locator('#notes').fill(options.notes);
    }
  }

  async save(): Promise<number> {
    const responsePromise = waitForSacramentCreateResponse(this.page);
    await this.page.getByTestId('save-sacrament').click();
    const response = await responsePromise;
    const body = await response.json();
    expect(body.success).toBeTruthy();
    return body.data?.id as number;
  }
}
