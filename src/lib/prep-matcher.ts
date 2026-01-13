import { getServiceSupabase } from './supabase';
import type { OHPrepResource } from '@/types';

/**
 * Match prep resources based on keywords in the booking question/response
 */
export async function matchPrepResources(
  eventId: string,
  questionResponses: Record<string, string>
): Promise<OHPrepResource[]> {
  const supabase = getServiceSupabase();

  // Get all prep resources for this event
  const { data: resources, error } = await supabase
    .from('oh_prep_resources')
    .select('*')
    .eq('event_id', eventId);

  if (error || !resources || resources.length === 0) {
    return [];
  }

  // Combine all question responses into a single search text
  const searchText = Object.values(questionResponses)
    .join(' ')
    .toLowerCase();

  // Find resources that match keywords
  const matchedResources = resources.filter((resource) => {
    if (!resource.keywords || resource.keywords.length === 0) {
      return false;
    }

    // Check if any keyword matches in the search text
    return resource.keywords.some((keyword: string) =>
      searchText.includes(keyword.toLowerCase())
    );
  });

  // Sort by number of keyword matches (most relevant first)
  matchedResources.sort((a, b) => {
    const aMatches = a.keywords.filter((k: string) =>
      searchText.includes(k.toLowerCase())
    ).length;
    const bMatches = b.keywords.filter((k: string) =>
      searchText.includes(k.toLowerCase())
    ).length;
    return bMatches - aMatches;
  });

  return matchedResources;
}

/**
 * Get all prep resources for an event
 */
export async function getPrepResources(eventId: string): Promise<OHPrepResource[]> {
  const supabase = getServiceSupabase();

  const { data: resources, error } = await supabase
    .from('oh_prep_resources')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch prep resources:', error);
    return [];
  }

  return resources || [];
}

/**
 * Create a new prep resource
 */
export async function createPrepResource(
  eventId: string,
  resource: {
    title: string;
    content: string;
    link?: string;
    keywords: string[];
  }
): Promise<OHPrepResource | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_prep_resources')
    .insert({
      event_id: eventId,
      title: resource.title,
      content: resource.content,
      link: resource.link || null,
      keywords: resource.keywords,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create prep resource:', error);
    return null;
  }

  return data;
}

/**
 * Update a prep resource
 */
export async function updatePrepResource(
  resourceId: string,
  updates: {
    title?: string;
    content?: string;
    link?: string | null;
    keywords?: string[];
  }
): Promise<OHPrepResource | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_prep_resources')
    .update(updates)
    .eq('id', resourceId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update prep resource:', error);
    return null;
  }

  return data;
}

/**
 * Delete a prep resource
 */
export async function deletePrepResource(resourceId: string): Promise<boolean> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_prep_resources')
    .delete()
    .eq('id', resourceId);

  if (error) {
    console.error('Failed to delete prep resource:', error);
    return false;
  }

  return true;
}

/**
 * Format matched resources as HTML for email
 */
export function formatResourcesForEmail(resources: OHPrepResource[]): string {
  if (!resources || resources.length === 0) {
    return '';
  }

  const resourcesHtml = resources
    .map(
      (resource) => `
      <div style="background: #F6F6F9; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #101E57; font-size: 14px;">${resource.title}</h4>
        <p style="margin: 0; color: #667085; font-size: 14px;">${resource.content}</p>
        ${
          resource.link
            ? `<a href="${resource.link}" style="display: inline-block; margin-top: 8px; color: #6F71EE; font-size: 14px; text-decoration: none;">Learn more →</a>`
            : ''
        }
      </div>
    `
    )
    .join('');

  return `
    <div style="margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: #101E57; font-size: 16px;">Preparation Resources</h3>
      <p style="margin: 0 0 16px 0; color: #667085; font-size: 14px;">Based on your topic, here are some resources to review before your session:</p>
      ${resourcesHtml}
    </div>
  `;
}
