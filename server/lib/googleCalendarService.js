/**
 * Google Calendar Service
 *
 * Creates calendar events via the coordinator's Google Calendar using OAuth2.
 * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in env.
 * If env vars are not set, methods return { error: 'Calendar not configured' }.
 */

import { google } from 'googleapis';

function getOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return null;
  }
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return auth;
}

/**
 * Create a calendar event for competition day (1 hour before start).
 * @param {{
 *   talentEmail: string,
 *   competitionName: string,
 *   startTime: string, // ISO timestamp
 *   discordInfo: string
 * }} options
 * @returns {Promise<{ eventId: string } | { error: string }>}
 */
export async function createCompetitionEvent({ talentEmail, competitionName, startTime, discordInfo }) {
  const auth = getOAuth2Client();
  if (!auth) {
    console.warn('[GoogleCalendarService] Calendar not configured — skipping event creation');
    return { error: 'Calendar not configured' };
  }

  const calendar = google.calendar({ version: 'v3', auth });

  // Parse startTime and create event 1 hour before
  const competitionStart = new Date(startTime);
  const eventStart = new Date(competitionStart.getTime() - 60 * 60 * 1000); // 1 hour before
  const eventEnd = new Date(competitionStart.getTime() + 3 * 60 * 60 * 1000); // 3 hours after competition start

  const event = {
    summary: `Commentary: ${competitionName}`,
    description: `Discord Info: ${discordInfo}\n\nPlease join the Discord room 15 minutes before the event starts.`,
    start: {
      dateTime: eventStart.toISOString(),
      timeZone: 'America/New_York', // TODO: Make timezone configurable if needed
    },
    end: {
      dateTime: eventEnd.toISOString(),
      timeZone: 'America/New_York',
    },
    attendees: [{ email: talentEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all', // Send email invitation to attendees
  });

  console.log(`[GoogleCalendarService] Created competition event for ${talentEmail} — eventId: ${res.data.id}`);
  return { eventId: res.data.id };
}

/**
 * Create a pre-production meeting calendar event.
 * @param {{
 *   talentEmail: string,
 *   meetingTime: string, // ISO timestamp
 *   competitionName: string
 * }} options
 * @returns {Promise<{ eventId: string } | { error: string }>}
 */
export async function createPreProdMeeting({ talentEmail, meetingTime, competitionName }) {
  const auth = getOAuth2Client();
  if (!auth) {
    console.warn('[GoogleCalendarService] Calendar not configured — skipping meeting creation');
    return { error: 'Calendar not configured' };
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const meetingStart = new Date(meetingTime);
  const meetingEnd = new Date(meetingStart.getTime() + 30 * 60 * 1000); // 30 minute meeting

  const event = {
    summary: `Pre-Production Call: ${competitionName}`,
    description: `Pre-production meeting for ${competitionName} commentary.\n\nWe'll review production details, answer questions, and ensure everything is ready for the event.`,
    start: {
      dateTime: meetingStart.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: meetingEnd.toISOString(),
      timeZone: 'America/New_York',
    },
    attendees: [{ email: talentEmail }],
    conferenceData: {
      createRequest: {
        requestId: `preprod-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }, // Create a Google Meet link
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1, // Required to create Google Meet link
    sendUpdates: 'all',
  });

  console.log(`[GoogleCalendarService] Created pre-prod meeting for ${talentEmail} — eventId: ${res.data.id}`);
  return { eventId: res.data.id };
}
