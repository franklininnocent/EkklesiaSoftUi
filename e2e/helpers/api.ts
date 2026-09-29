import { APIResponse, Page, Response } from '@playwright/test';

export async function waitForMemberSearchResponse(
  page: Page,
  searchTerm: string
): Promise<Response> {
  return page.waitForResponse((response) => {
    if (!response.url().includes('/api/members')) {
      return false;
    }
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    const search = url.searchParams.get('search') || '';
    return search.includes(searchTerm) && response.ok();
  });
}

export async function waitForSacramentCreateResponse(page: Page): Promise<Response> {
  return page.waitForResponse((response) => {
    return response.url().includes('/api/sacraments')
      && response.request().method() === 'POST'
      && response.ok();
  });
}

export async function waitForSacramentDetailResponse(page: Page, id: number): Promise<Response> {
  return page.waitForResponse((response) => {
    return response.url().includes(`/api/sacraments/${id}`)
      && response.request().method() === 'GET'
      && response.ok();
  });
}

export async function deleteSacrament(page: Page, id: number): Promise<APIResponse> {
  return page.request.delete(`/api/sacraments/${id}`);
}

export interface SacramentParticipantSnapshot {
  role?: string;
  snapshot_json?: {
    full_name?: string;
    date_of_birth?: string;
    gender?: string;
    father_name?: string;
    mother_name?: string;
  };
}

export function findRecipientSnapshot(
  participants: SacramentParticipantSnapshot[] | undefined,
  role = 'recipient'
): SacramentParticipantSnapshot | undefined {
  return participants?.find((participant) => participant.role === role);
}
