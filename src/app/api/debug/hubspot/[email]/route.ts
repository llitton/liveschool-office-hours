import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHubSpotConfig } from '@/lib/hubspot';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Debug endpoint to see raw HubSpot API responses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email).toLowerCase();

  const config = await getHubSpotConfig();
  if (!config) {
    return NextResponse.json({ error: 'HubSpot not configured' });
  }

  const results: Record<string, unknown> = {
    email: decodedEmail,
    portalId: config.portal_id,
  };

  // Search for contact
  try {
    const searchResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.access_token}`,
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: 'email', operator: 'EQ', value: decodedEmail },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'associatedcompanyid'],
      }),
    });

    results.contactSearchStatus = searchResponse.status;
    const contactSearchData = await searchResponse.json();
    results.contactSearchResponse = contactSearchData;

    const contactId = contactSearchData?.results?.[0]?.id;
    results.contactId = contactId;

    if (contactId) {
      // Get company details using the associatedcompanyid
      const associatedCompanyId = contactSearchData?.results?.[0]?.properties?.associatedcompanyid;
      if (associatedCompanyId) {
        results.associatedCompanyId = associatedCompanyId;
        const companyDetailsResponse = await fetch(
          `${HUBSPOT_API_BASE}/crm/v3/objects/companies/${associatedCompanyId}?properties=name,domain`,
          {
            headers: { Authorization: `Bearer ${config.access_token}` },
          }
        );
        results.companyDetailsStatus = companyDetailsResponse.status;
        results.companyDetailsResponse = await companyDetailsResponse.json();
      }

      // Get deals via v3 associations
      const dealsResponse = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/deals`,
        {
          headers: { Authorization: `Bearer ${config.access_token}` },
        }
      );
      results.dealsAssocStatus = dealsResponse.status;
      const dealsData = await dealsResponse.json();
      results.dealsAssocResponse = dealsData;

      // Get first deal details
      const firstDealId = dealsData?.results?.[0]?.id;
      if (firstDealId) {
        results.firstDealId = firstDealId;
        const dealDetailsResponse = await fetch(
          `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${firstDealId}?properties=dealname,dealstage,amount`,
          {
            headers: { Authorization: `Bearer ${config.access_token}` },
          }
        );
        results.dealDetailsStatus = dealDetailsResponse.status;
        results.dealDetailsResponse = await dealDetailsResponse.json();
      }
    }
  } catch (err) {
    results.error = err instanceof Error ? err.message : 'Unknown error';
  }

  return NextResponse.json(results, { status: 200 });
}
