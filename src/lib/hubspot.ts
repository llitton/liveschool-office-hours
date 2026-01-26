import { getServiceSupabase } from './supabase';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

interface HubSpotTokens {
  access_token: string;
  refresh_token: string;
  portal_id: string;
}

interface ContactProperties {
  email: string;
  firstname?: string;
  lastname?: string;
  associatedcompanyid?: string;
  jobtitle?: string;
  user_type__liveschool_?: string;
  user_type?: string;
  [key: string]: string | undefined;
}

interface HubSpotContact {
  id: string;
  properties: ContactProperties;
}

interface HubSpotTask {
  subject: string;
  body?: string;
  dueDate?: Date;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  contactId: string;
}

/**
 * Get HubSpot configuration from database
 * If portal_id is missing, fetches it from HubSpot API and updates the database
 */
export async function getHubSpotConfig(): Promise<HubSpotTokens | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_hubspot_config')
    .select('id, access_token, refresh_token, portal_id')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  let portalId = data.portal_id || '';

  // If portal_id is missing, fetch it from HubSpot and save it
  if (!portalId && data.access_token) {
    try {
      const response = await fetch(
        `https://api.hubapi.com/oauth/v1/access-tokens/${data.access_token}`
      );
      if (response.ok) {
        const tokenInfo = await response.json();
        if (tokenInfo.hub_id) {
          portalId = tokenInfo.hub_id.toString();
          // Update the database with the portal_id
          await supabase
            .from('oh_hubspot_config')
            .update({ portal_id: portalId })
            .eq('id', data.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot portal ID:', err);
    }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    portal_id: portalId,
  };
}

/**
 * Refresh HubSpot access token
 */
export async function refreshHubSpotToken(refreshToken: string): Promise<HubSpotTokens | null> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('HubSpot client credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh HubSpot token');
    }

    const data = await response.json();

    // Update tokens in database
    const supabase = getServiceSupabase();
    await supabase
      .from('oh_hubspot_config')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      .eq('is_active', true);

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      portal_id: '',
    };
  } catch (error) {
    console.error('Failed to refresh HubSpot token:', error);
    return null;
  }
}

/**
 * Make authenticated HubSpot API request
 */
async function hubspotFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = await getHubSpotConfig();
  if (!config) {
    throw new Error('HubSpot not configured');
  }

  const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.access_token}`,
      ...options.headers,
    },
  });

  // If unauthorized, try refreshing token
  if (response.status === 401 && config.refresh_token) {
    const newTokens = await refreshHubSpotToken(config.refresh_token);
    if (newTokens) {
      return fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newTokens.access_token}`,
          ...options.headers,
        },
      });
    }
  }

  return response;
}

/**
 * Search for a contact by email
 */
export async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotFetch('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'hs_object_id', 'phone', 'mobilephone', 'associatedcompanyid', 'jobtitle', 'user_type__liveschool_', 'user_type'],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error('Failed to search HubSpot contact:', error);
    return null;
  }
}

/**
 * Create a new contact in HubSpot
 */
export async function createContact(
  email: string,
  firstName?: string,
  lastName?: string
): Promise<HubSpotContact | null> {
  try {
    const properties: ContactProperties = { email };
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;

    const response = await hubspotFetch('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create HubSpot contact:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create HubSpot contact:', error);
    return null;
  }
}

/**
 * Find or create a contact by email
 */
export async function findOrCreateContact(
  email: string,
  firstName?: string,
  lastName?: string
): Promise<HubSpotContact | null> {
  // First, try to find existing contact
  const existing = await findContactByEmail(email);
  if (existing) {
    return existing;
  }

  // Create new contact
  return createContact(email, firstName, lastName);
}

/**
 * Update contact properties
 */
export async function updateContactProperties(
  contactId: string,
  properties: Record<string, string>
): Promise<boolean> {
  try {
    const response = await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to update HubSpot contact:', error);
    return false;
  }
}

/**
 * Log a meeting/engagement on a contact
 */
export async function logMeetingActivity(
  contactId: string,
  booking: {
    id: string;
    attendee_email: string;
    attendee_name: string;
    response_text?: string;
    status: string;
  },
  event: {
    name: string;
    description?: string;
    hubspot_meeting_type?: string | null; // The hs_activity_type value to use
  },
  slot: {
    start_time: string;
    end_time: string;
    google_meet_link?: string;
  }
): Promise<string | null> {
  try {
    const startTime = new Date(slot.start_time);
    const endTime = new Date(slot.end_time);

    const body = `
Session: ${event.name}

Attendee: ${booking.attendee_name} (${booking.attendee_email})
Status: ${booking.status}
${booking.response_text ? `\nQuestion/Topic:\n${booking.response_text}` : ''}
${slot.google_meet_link ? `\nMeet Link: ${slot.google_meet_link}` : ''}
    `.trim();

    // Build meeting properties
    const meetingProperties: Record<string, string> = {
      hs_meeting_title: `Connect: ${event.name}`,
      hs_meeting_body: body,
      hs_meeting_start_time: startTime.toISOString(),
      hs_meeting_end_time: endTime.toISOString(),
      hs_meeting_outcome: booking.status === 'attended' ? 'COMPLETED' : 'SCHEDULED',
      hs_internal_meeting_notes: booking.response_text || '',
    };

    // Add activity type (HubSpot meeting type) if specified
    if (event.hubspot_meeting_type) {
      meetingProperties.hs_activity_type = event.hubspot_meeting_type;
    }

    const response = await hubspotFetch('/crm/v3/objects/meetings', {
      method: 'POST',
      body: JSON.stringify({
        properties: meetingProperties,
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 200, // Meeting to Contact
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to log HubSpot meeting:', error);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Failed to log HubSpot meeting:', error);
    return null;
  }
}

/**
 * Create a task in HubSpot
 */
export async function createTask(task: HubSpotTask): Promise<string | null> {
  try {
    const response = await hubspotFetch('/crm/v3/objects/tasks', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_task_subject: task.subject,
          hs_task_body: task.body || '',
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: task.priority || 'MEDIUM',
          hs_timestamp: task.dueDate
            ? task.dueDate.getTime()
            : Date.now() + 7 * 24 * 60 * 60 * 1000, // Default: 1 week from now
        },
        associations: [
          {
            to: { id: task.contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 204, // Task to Contact
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create HubSpot task:', error);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Failed to create HubSpot task:', error);
    return null;
  }
}

/**
 * Get HubSpot contact details with recent activities
 */
export async function getContactDetails(contactId: string): Promise<{
  contact: HubSpotContact;
  recentMeetings: number;
} | null> {
  try {
    const response = await hubspotFetch(
      `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,hs_object_id,notes_last_updated,num_associated_deals`
    );

    if (!response.ok) {
      return null;
    }

    const contact = await response.json();

    // Get associated meetings count
    const meetingsResponse = await hubspotFetch(
      `/crm/v4/objects/contacts/${contactId}/associations/meetings`
    );

    let recentMeetings = 0;
    if (meetingsResponse.ok) {
      const meetingsData = await meetingsResponse.json();
      recentMeetings = meetingsData.results?.length || 0;
    }

    return { contact, recentMeetings };
  } catch (error) {
    console.error('Failed to get HubSpot contact details:', error);
    return null;
  }
}

export interface HubSpotEnrichedContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null; // Job title or user type
  company: {
    id: string;
    name: string;
    customerSince: string | null; // Year they became a customer (earliest closed-won deal)
    closedWonDeals: number; // Number of closed-won deals (approximates years as a partner)
    totalArr: number | null; // Sum of all closed-won deal amounts
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    amount: number | null;
    isCompanyDeal?: boolean; // true if deal is from company, not directly on contact
  } | null;
  meetingsCount: number;
  lastContactedAt: string | null;
}

/**
 * Get enriched contact data with company and deal info
 */
export async function getContactWithCompany(email: string): Promise<HubSpotEnrichedContact | null> {
  try {
    // First find the contact by email
    const contact = await findContactByEmail(email);
    if (!contact) {
      return null;
    }

    // Get role from user_type field (try both custom property names) or job title
    const role = contact.properties.user_type || contact.properties.user_type__liveschool_ || contact.properties.jobtitle || null;

    const result: HubSpotEnrichedContact = {
      id: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname || null,
      lastName: contact.properties.lastname || null,
      role,
      company: null,
      deal: null,
      meetingsCount: 0,
      lastContactedAt: null,
    };

    // Get associated companies - try associatedcompanyid property first, then v3 associations API
    try {
      let companyId: string | null = null;

      // First check if contact has associatedcompanyid property (primary company)
      if (contact.properties.associatedcompanyid) {
        companyId = contact.properties.associatedcompanyid;
      }

      // If no primary company, try v3 associations API
      if (!companyId) {
        const companiesResponse = await hubspotFetch(
          `/crm/v3/objects/contacts/${contact.id}/associations/companies`
        );
        if (companiesResponse.ok) {
          const companiesData = await companiesResponse.json();
          if (companiesData.results && companiesData.results.length > 0) {
            // v3 API returns { results: [{ id: "123", type: "contact_to_company" }] }
            companyId = companiesData.results[0].id;
          }
        } else {
          const errorText = await companiesResponse.text();
          console.error('Company association request failed:', companiesResponse.status, errorText);
        }
      }

      // If we found a company ID, get its details and deals
      if (companyId) {
        const companyResponse = await hubspotFetch(
          `/crm/v3/objects/companies/${companyId}?properties=name,domain`
        );
        if (companyResponse.ok) {
          const companyData = await companyResponse.json();

          // Get company deals to calculate partnership info
          let customerSince: string | null = null;
          let closedWonDeals = 0;
          let totalArr: number | null = null;

          try {
            const companyDealsResponse = await hubspotFetch(
              `/crm/v3/objects/companies/${companyId}/associations/deals`
            );
            if (companyDealsResponse.ok) {
              const companyDealsData = await companyDealsResponse.json();
              if (companyDealsData.results && companyDealsData.results.length > 0) {
                // Fetch details for all deals to find closed-won ones
                const dealIds = companyDealsData.results.slice(0, 20).map((d: { id: string }) => d.id);

                for (const dealId of dealIds) {
                  const dealResponse = await hubspotFetch(
                    `/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,amount,closedate`
                  );
                  if (dealResponse.ok) {
                    const dealData = await dealResponse.json();
                    const stage = dealData.properties.dealstage?.toLowerCase() || '';

                    // Check if it's a closed-won deal (stage usually contains "closedwon" or similar)
                    if (stage.includes('closedwon') || stage === 'closedwon' || stage.includes('closed won')) {
                      closedWonDeals++;

                      // Track total ARR
                      if (dealData.properties.amount) {
                        totalArr = (totalArr || 0) + parseFloat(dealData.properties.amount);
                      }

                      // Track earliest close date
                      if (dealData.properties.closedate) {
                        const closeYear = new Date(dealData.properties.closedate).getFullYear().toString();
                        if (!customerSince || closeYear < customerSince) {
                          customerSince = closeYear;
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (dealErr) {
            console.error('Failed to fetch company deals:', dealErr);
          }

          result.company = {
            id: companyId,
            name: companyData.properties.name || 'Unknown Company',
            customerSince,
            closedWonDeals,
            totalArr,
          };
        }
      }
    } catch (err) {
      console.error('Failed to fetch company association:', err);
    }

    // Get associated deals using v3 associations API (contact's direct deals)
    try {
      const dealsResponse = await hubspotFetch(
        `/crm/v3/objects/contacts/${contact.id}/associations/deals`
      );
      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        if (dealsData.results && dealsData.results.length > 0) {
          // v3 API returns { results: [{ id: "123", type: "contact_to_deal" }] }
          const dealId = dealsData.results[0].id;
          if (dealId) {
            // Get deal details
            const dealResponse = await hubspotFetch(
              `/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,amount,hs_lastmodifieddate`
            );
            if (dealResponse.ok) {
              const dealData = await dealResponse.json();
              result.deal = {
                id: dealId,
                name: dealData.properties.dealname || 'Unknown Deal',
                stage: dealData.properties.dealstage || 'unknown',
                amount: dealData.properties.amount ? parseFloat(dealData.properties.amount) : null,
                isCompanyDeal: false,
              };
            }
          }
        }
      } else {
        const errorText = await dealsResponse.text();
        console.error('Deal association request failed:', dealsResponse.status, errorText);
      }
    } catch (err) {
      console.error('Failed to fetch deal association:', err);
    }

    // If no direct deal on contact but company has totalArr, show that as company-level deal
    if (!result.deal && result.company?.totalArr) {
      result.deal = {
        id: 'company-arr',
        name: 'Company ARR',
        stage: 'closedwon',
        amount: result.company.totalArr,
        isCompanyDeal: true,
      };
    }

    // Get meetings count
    try {
      const meetingsResponse = await hubspotFetch(
        `/crm/v4/objects/contacts/${contact.id}/associations/meetings`
      );
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json();
        result.meetingsCount = meetingsData.results?.length || 0;
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    }

    // Get last activity date
    try {
      const activityResponse = await hubspotFetch(
        `/crm/v3/objects/contacts/${contact.id}?properties=notes_last_contacted`
      );
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        result.lastContactedAt = activityData.properties.notes_last_contacted || null;
      }
    } catch (err) {
      // Ignore - not critical
    }

    return result;
  } catch (error) {
    console.error('Failed to get enriched contact:', error);
    return null;
  }
}

/**
 * Update HubSpot meeting outcome based on attendance
 */
export async function updateMeetingOutcome(
  contactId: string,
  meetingTitle: string,
  outcome: 'COMPLETED' | 'NO_SHOW' | 'CANCELED',
  notes?: string
): Promise<boolean> {
  try {
    // Find meetings associated with this contact
    const meetingsResponse = await hubspotFetch(
      `/crm/v4/objects/contacts/${contactId}/associations/meetings`
    );

    if (!meetingsResponse.ok) {
      return false;
    }

    const meetingsData = await meetingsResponse.json();
    if (!meetingsData.results || meetingsData.results.length === 0) {
      return false;
    }

    // Find the meeting with matching title (most recent first)
    for (const assoc of meetingsData.results) {
      const meetingResponse = await hubspotFetch(
        `/crm/v3/objects/meetings/${assoc.toObjectId}?properties=hs_meeting_title,hs_meeting_outcome`
      );

      if (meetingResponse.ok) {
        const meeting = await meetingResponse.json();
        if (meeting.properties.hs_meeting_title?.includes(meetingTitle)) {
          // Update this meeting's outcome
          const updateResponse = await hubspotFetch(
            `/crm/v3/objects/meetings/${assoc.toObjectId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                properties: {
                  hs_meeting_outcome: outcome,
                  ...(notes ? { hs_internal_meeting_notes: notes } : {}),
                },
              }),
            }
          );
          return updateResponse.ok;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to update HubSpot meeting outcome:', error);
    return false;
  }
}

/**
 * Check if HubSpot is configured and connected
 */
export async function isHubSpotConnected(): Promise<boolean> {
  const config = await getHubSpotConfig();
  if (!config) return false;

  try {
    // Test the connection with a simple API call
    const response = await hubspotFetch('/crm/v3/objects/contacts?limit=1');
    return response.ok;
  } catch {
    return false;
  }
}

export interface HubSpotMeetingType {
  value: string;      // Internal value to use when creating meetings
  label: string;      // Display label shown in HubSpot UI
  displayOrder: number;
  hidden: boolean;
}

/**
 * Get available HubSpot meeting types (hs_activity_type options)
 * These are the user-defined meeting types configured in HubSpot settings
 */
export async function getHubSpotMeetingTypes(): Promise<HubSpotMeetingType[]> {
  try {
    const response = await hubspotFetch('/crm/v3/properties/meetings/hs_activity_type');

    if (!response.ok) {
      console.error('Failed to fetch HubSpot meeting types:', response.status);
      return [];
    }

    const data = await response.json();

    // The response contains an 'options' array with the meeting types
    if (data.options && Array.isArray(data.options)) {
      return data.options
        .filter((opt: HubSpotMeetingType) => !opt.hidden)
        .map((opt: { value: string; label: string; displayOrder?: number; hidden?: boolean }) => ({
          value: opt.value,
          label: opt.label,
          displayOrder: opt.displayOrder || 0,
          hidden: opt.hidden || false,
        }))
        .sort((a: HubSpotMeetingType, b: HubSpotMeetingType) => a.displayOrder - b.displayOrder);
    }

    return [];
  } catch (error) {
    console.error('Failed to get HubSpot meeting types:', error);
    return [];
  }
}
