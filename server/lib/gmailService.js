/**
 * Gmail Service
 *
 * Sends emails via the coordinator's Gmail account using OAuth2.
 * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in env.
 * If env vars are not set, methods return { error: 'Gmail not configured' }.
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
 * Send an email via Gmail API.
 * @param {{ to: string, subject: string, html: string }} options
 * @returns {Promise<{ messageId: string } | { error: string }>}
 */
export async function sendEmail({ to, subject, html }) {
  const auth = getOAuth2Client();
  if (!auth) {
    console.warn('[GmailService] Gmail not configured — skipping send');
    return { error: 'Gmail not configured' };
  }

  const gmail = google.gmail({ version: 'v1', auth });

  // Build RFC 2822 message
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    html,
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });

  console.log(`[GmailService] Sent email to ${to} — messageId: ${res.data.id}`);
  return { messageId: res.data.id };
}

// ============================================================================
// Email Templates
// ============================================================================

/**
 * Invite email — sent when a coordinator invites talent to a competition.
 * @param {{ name: string }} talent
 * @param {{ eventName: string, meetDate: string, venue: string }} competition
 * @param {string} role — 'pbp' | 'analyst' | 'both'
 * @param {string} bookingUrl — unique booking link for this talent+competition
 * @returns {{ to: string, subject: string, html: string }}
 */
export function inviteEmail(talent, competition, role, bookingUrl) {
  const roleLabel = role === 'pbp' ? 'Play-by-Play' : role === 'analyst' ? 'Color Analyst' : 'Commentary';
  const subject = `Commentary Invitation: ${competition.eventName}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a2e;">Commentary Invitation</h2>
  <p>Hi ${talent.name},</p>
  <p>You're invited to join the commentary team for the following event:</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold; width: 140px;">Event</td><td style="padding: 8px;">${competition.eventName}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${competition.meetDate}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Venue</td><td style="padding: 8px;">${competition.venue || 'TBD'}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding: 8px; font-weight: bold;">Your Role</td><td style="padding: 8px;">${roleLabel}</td></tr>
  </table>
  <p>Please let us know if you're available by clicking the link below:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="${bookingUrl}" style="background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px;">
      Respond to Invitation
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">This link expires in 30 days.</p>
  <p>Questions? Reply to this email.</p>
  <p>Thanks,<br>Commentary Coordination Team</p>
</div>`;
  return { subject, html };
}

/**
 * Briefing email — sent after talent is confirmed with full production details.
 * @param {{ name: string }} talent
 * @param {{ eventName: string, meetDate: string, venue: string }} competition
 * @param {string} virtiusUrl
 * @param {string} discordInfo
 * @param {string} preProdTime — ISO timestamp
 * @returns {{ subject: string, html: string }}
 */
export function briefingEmail(talent, competition, virtiusUrl, discordInfo, preProdTime) {
  const preProdFormatted = preProdTime ? new Date(preProdTime).toLocaleString() : 'TBD';
  const commentaryUrl = `https://commentarygraphic.com/commentary`;
  const subject = `Pre-Production Briefing: ${competition.eventName}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a2e;">Production Briefing</h2>
  <p>Hi ${talent.name},</p>
  <p>Here are your production details for <strong>${competition.eventName}</strong>:</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold; width: 160px;">Event</td><td style="padding: 8px;">${competition.eventName}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${competition.meetDate}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Venue</td><td style="padding: 8px;">${competition.venue || 'TBD'}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding: 8px; font-weight: bold;">Virtius Session</td><td style="padding: 8px;"><a href="${virtiusUrl}">${virtiusUrl}</a></td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Commentary View</td><td style="padding: 8px;"><a href="${commentaryUrl}">${commentaryUrl}</a></td></tr>
    <tr style="background:#f5f5f5;"><td style="padding: 8px; font-weight: bold;">Discord</td><td style="padding: 8px;">${discordInfo}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Pre-Production Call</td><td style="padding: 8px;">${preProdFormatted}</td></tr>
  </table>
  <p>See you on air!</p>
  <p>Thanks,<br>Commentary Coordination Team</p>
</div>`;
  return { subject, html };
}

/**
 * Reminder email — sent as a follow-up when talent hasn't responded.
 * @param {{ name: string }} talent
 * @param {{ eventName: string, meetDate: string }} competition
 * @param {string} bookingUrl
 * @returns {{ subject: string, html: string }}
 */
export function reminderEmail(talent, competition, bookingUrl) {
  const subject = `Reminder: Commentary Invitation for ${competition.eventName}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a2e;">Reminder: Commentary Invitation</h2>
  <p>Hi ${talent.name},</p>
  <p>Just a quick reminder — we'd love to have you on the commentary team for <strong>${competition.eventName}</strong> on ${competition.meetDate}.</p>
  <p>Please let us know your availability when you get a chance:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="${bookingUrl}" style="background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px;">
      Respond to Invitation
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">No worries if you're not available — just let us know!</p>
  <p>Thanks,<br>Commentary Coordination Team</p>
</div>`;
  return { subject, html };
}
