import { describe, it, expect } from 'vitest';
import {
  generateConfirmationEmailHtml,
  generateReminderEmailHtml,
  generateFollowupEmailHtml,
  generateFeedbackEmailHtml,
  generateRecordingEmailHtml,
  generateCancellationEmailHtml,
} from '@/lib/email-html';

describe('Email HTML Templates', () => {
  describe('generateConfirmationEmailHtml', () => {
    const baseData = {
      firstName: 'Laura',
      eventName: 'Office Hours',
      hostName: 'Sarah Smith',
      date: 'Thursday, January 23, 2026',
      time: '3:00 PM',
      timezoneAbbr: 'CT',
      timezone: 'Central Time',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      manageUrl: 'https://liveschoolhelp.com/manage/token123',
      googleCalUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
      outlookUrl: 'https://outlook.live.com/calendar/0/deeplink/compose',
      icalUrl: 'https://liveschoolhelp.com/api/ical/token123',
    };

    it('generates valid HTML document', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('includes event name in hero section', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Office Hours');
      expect(html).toContain("You're all set");
    });

    it('includes date and time with timezone', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Thursday, January 23, 2026');
      expect(html).toContain('3:00 PM');
      expect(html).toContain('CT');
      expect(html).toContain('Central Time');
    });

    it('includes host name', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Sarah Smith');
    });

    it('includes Google Meet link when provided', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('https://meet.google.com/abc-defg-hij');
      expect(html).toContain('Join Google Meet');
    });

    it('omits Join Meeting section when no meet link', () => {
      const dataWithoutMeet = { ...baseData, meetLink: null };
      const html = generateConfirmationEmailHtml(dataWithoutMeet);

      expect(html).not.toContain('Join Google Meet');
    });

    it('includes all three calendar buttons', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Google');
      expect(html).toContain('Outlook');
      expect(html).toContain('Apple');
      expect(html).toContain(baseData.googleCalUrl);
      expect(html).toContain(baseData.outlookUrl);
      expect(html).toContain(baseData.icalUrl);
    });

    it('includes reschedule/cancel link', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Reschedule or Cancel');
      expect(html).toContain(baseData.manageUrl);
    });

    it('includes school name when provided', () => {
      const dataWithSchool = { ...baseData, schoolName: 'Lincoln Elementary' };
      const html = generateConfirmationEmailHtml(dataWithSchool);

      expect(html).toContain('Lincoln Elementary');
    });

    it('includes event description when provided', () => {
      const dataWithDesc = {
        ...baseData,
        eventDescription: 'A one-on-one session to discuss your questions about LiveSchool.',
      };
      const html = generateConfirmationEmailHtml(dataWithDesc);

      expect(html).toContain('About This Session');
      expect(html).toContain('A one-on-one session to discuss your questions about LiveSchool.');
    });

    it('includes user topic when provided', () => {
      const dataWithTopic = {
        ...baseData,
        userTopic: 'How do I set up rewards for students?',
      };
      const html = generateConfirmationEmailHtml(dataWithTopic);

      expect(html).toContain('What you want to discuss');
      expect(html).toContain('How do I set up rewards for students?');
    });

    it('includes prep materials checklist when provided', () => {
      const dataWithPrep = {
        ...baseData,
        prepMaterials: 'Review your current setup\nPrepare questions',
      };
      const html = generateConfirmationEmailHtml(dataWithPrep);

      expect(html).toContain('Before Your Session');
      expect(html).toContain('Review your current setup');
      expect(html).toContain('Prepare questions');
    });

    it('includes prep resources when provided', () => {
      const dataWithResources = {
        ...baseData,
        prepResources: [
          { title: 'Getting Started Guide', content: 'Learn the basics', link: 'https://example.com/guide' },
          { title: 'FAQ', content: 'Common questions', link: 'https://example.com/faq' },
        ],
      };
      const html = generateConfirmationEmailHtml(dataWithResources);

      expect(html).toContain('Helpful Resources');
      expect(html).toContain('Getting Started Guide');
      expect(html).toContain('Learn the basics');
      expect(html).toContain('https://example.com/guide');
      expect(html).toContain('FAQ');
      expect(html).toContain('Common questions');
    });

    it('includes custom body HTML when provided', () => {
      const dataWithCustomBody = {
        ...baseData,
        customBodyHtml: '<p>Custom welcome message here!</p>',
      };
      const html = generateConfirmationEmailHtml(dataWithCustomBody);

      expect(html).toContain('Custom welcome message here!');
      // Custom body replaces default "What to Expect" section
      expect(html).not.toContain('What to Expect');
    });

    it('shows default "What to Expect" when no custom body', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('What to Expect');
      expect(html).toContain('Your Time, Your Topics');
      expect(html).toContain('Practical Guidance');
    });

    it('uses brand colors in styling', () => {
      const html = generateConfirmationEmailHtml(baseData);

      // Check for brand purple
      expect(html).toContain('#6F71EE');
      // Check for brand navy
      expect(html).toContain('#101E57');
      // Check for brand green
      expect(html).toContain('#417762');
    });

    it('includes LiveSchool branding in footer', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('Connect with LiveSchool');
    });

    it('uses table-based layout for email compatibility', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
      expect(html).toContain('<td');
    });

    it('includes viewport meta tag for mobile', () => {
      const html = generateConfirmationEmailHtml(baseData);

      expect(html).toContain('width=device-width, initial-scale=1.0');
    });

    it('uses inline styles (not external stylesheets)', () => {
      const html = generateConfirmationEmailHtml(baseData);

      // Should have inline styles
      expect(html).toContain('style="');
      // Should not link external stylesheets
      expect(html).not.toContain('<link rel="stylesheet"');
    });
  });

  describe('generateReminderEmailHtml', () => {
    const baseData = {
      firstName: 'Laura',
      eventName: 'Office Hours',
      hostName: 'Sarah Smith',
      date: 'Thursday, January 23',
      time: '3:00 PM',
      timezoneAbbr: 'CT',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      manageUrl: 'https://liveschoolhelp.com/manage/token123',
      reminderTiming: 'tomorrow',
    };

    it('generates valid HTML document', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('includes greeting with first name', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Hi Laura');
    });

    it('includes event details', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Office Hours');
      expect(html).toContain('Thursday, January 23');
      expect(html).toContain('3:00 PM');
      expect(html).toContain('CT');
      expect(html).toContain('Sarah Smith');
    });

    it('includes reminder timing in header', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('See you tomorrow');
    });

    it('uses purple header for day-before reminders', () => {
      const html = generateReminderEmailHtml(baseData);

      // Brand purple
      expect(html).toContain('#6F71EE');
    });

    it('uses urgent (amber) header for hour-before reminders', () => {
      const urgentData = { ...baseData, reminderTiming: 'in about 1 hour' };
      const html = generateReminderEmailHtml(urgentData);

      // Amber/warning color
      expect(html).toContain('#F59E0B');
    });

    it('includes Google Meet link when provided', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('https://meet.google.com/abc-defg-hij');
      expect(html).toContain('Join Google Meet');
    });

    it('omits Join Meeting button when no meet link', () => {
      const dataWithoutMeet = { ...baseData, meetLink: null };
      const html = generateReminderEmailHtml(dataWithoutMeet);

      expect(html).not.toContain('Join Google Meet');
    });

    it('includes reschedule link', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('Need to reschedule');
      expect(html).toContain(baseData.manageUrl);
    });

    it('uses calendar emoji for day-before reminders', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('📅');
    });

    it('uses clock emoji for hour-before reminders', () => {
      const urgentData = { ...baseData, reminderTiming: 'in about 1 hour' };
      const html = generateReminderEmailHtml(urgentData);

      expect(html).toContain('⏰');
    });

    it('uses table-based layout for email compatibility', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
    });

    it('uses inline styles', () => {
      const html = generateReminderEmailHtml(baseData);

      expect(html).toContain('style="');
      expect(html).not.toContain('<link rel="stylesheet"');
    });
  });

  describe('generateFollowupEmailHtml', () => {
    const baseData = {
      recipientFirstName: 'Laura',
      eventName: 'Office Hours',
      hostName: 'Sarah Smith',
      sessionDate: 'Friday, January 31',
      sessionTime: '10:30 AM',
      timezoneAbbr: 'CT',
      bookingPageUrl: 'https://liveschoolhelp.com/book/office-hours',
    };

    it('generates valid HTML document', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('includes personalized greeting for attended sessions', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('Thanks for joining, Laura!');
      expect(html).toContain('Great chatting with you at Office Hours');
    });

    it('includes session date and time', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('Friday, January 31');
      expect(html).toContain('10:30 AM');
      expect(html).toContain('CT');
    });

    it('includes host name', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('Hosted by Sarah Smith');
    });

    it('uses purple header for attended sessions', () => {
      const html = generateFollowupEmailHtml(baseData);

      // Brand purple
      expect(html).toContain('#6F71EE');
    });

    it('uses amber header for no-show sessions', () => {
      const noShowData = { ...baseData, isNoShow: true };
      const html = generateFollowupEmailHtml(noShowData);

      // Amber/warning color
      expect(html).toContain('#F59E0B');
      expect(html).toContain('We missed you, Laura!');
      expect(html).toContain("We're sorry we couldn't connect at Office Hours");
    });

    it('includes recording link when provided', () => {
      const dataWithRecording = {
        ...baseData,
        recordingLink: 'https://fireflies.ai/view/abc123',
      };
      const html = generateFollowupEmailHtml(dataWithRecording);

      expect(html).toContain('https://fireflies.ai/view/abc123');
      expect(html).toContain('Watch Recording');
    });

    it('includes deck link when provided', () => {
      const dataWithDeck = {
        ...baseData,
        deckLink: 'https://docs.google.com/presentation/d/abc123',
      };
      const html = generateFollowupEmailHtml(dataWithDeck);

      expect(html).toContain('https://docs.google.com/presentation/d/abc123');
      expect(html).toContain('View Slides');
    });

    it('includes shared links when provided', () => {
      const dataWithLinks = {
        ...baseData,
        sharedLinks: [
          { title: 'Getting Started Guide', url: 'https://example.com/guide' },
          { title: 'Help Center', url: 'https://example.com/help' },
        ],
      };
      const html = generateFollowupEmailHtml(dataWithLinks);

      expect(html).toContain('Getting Started Guide');
      expect(html).toContain('https://example.com/guide');
      expect(html).toContain('Help Center');
      expect(html).toContain('https://example.com/help');
    });

    it('shows resources section with emoji icons', () => {
      const dataWithResources = {
        ...baseData,
        recordingLink: 'https://example.com/recording',
        deckLink: 'https://example.com/deck',
      };
      const html = generateFollowupEmailHtml(dataWithResources);

      expect(html).toContain('📚');
      expect(html).toContain('🎥');
      expect(html).toContain('📊');
    });

    it('omits resources section for no-shows', () => {
      const noShowWithResources = {
        ...baseData,
        isNoShow: true,
        recordingLink: 'https://example.com/recording',
        deckLink: 'https://example.com/deck',
      };
      const html = generateFollowupEmailHtml(noShowWithResources);

      expect(html).not.toContain('Session Resources');
      // Should not contain actual links/buttons (not checking HTML comments)
      expect(html).not.toContain('href="https://example.com/recording"');
      expect(html).not.toContain('href="https://example.com/deck"');
      expect(html).not.toContain('Watch Recording →');
      expect(html).not.toContain('View Slides →');
    });

    it('includes book another session CTA for attended', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('Want to continue the conversation?');
      expect(html).toContain('Book Another Session');
      expect(html).toContain('https://liveschoolhelp.com/book/office-hours');
    });

    it('includes book session CTA for no-shows', () => {
      const noShowData = { ...baseData, isNoShow: true };
      const html = generateFollowupEmailHtml(noShowData);

      expect(html).toContain("Let's find a time that works");
      expect(html).toContain('Book a Session');
      expect(html).toContain('https://liveschoolhelp.com/book/office-hours');
    });

    it('includes custom message when provided', () => {
      const dataWithMessage = {
        ...baseData,
        customMessage: 'Thanks so much for meeting today!\n\nLet me know if you have any questions.',
      };
      const html = generateFollowupEmailHtml(dataWithMessage);

      expect(html).toContain('Thanks so much for meeting today!');
      expect(html).toContain('Let me know if you have any questions.');
    });

    it('includes footer with reply prompt', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('Questions? Just reply to this email.');
      expect(html).toContain('Connect with LiveSchool');
    });

    it('uses brand colors in styling', () => {
      const html = generateFollowupEmailHtml(baseData);

      // Check for brand purple
      expect(html).toContain('#6F71EE');
      // Check for brand navy
      expect(html).toContain('#101E57');
      // Check for brand green (for Watch Recording button)
      const dataWithRecording = { ...baseData, recordingLink: 'https://example.com' };
      const htmlWithRecording = generateFollowupEmailHtml(dataWithRecording);
      expect(htmlWithRecording).toContain('#417762');
    });

    it('uses table-based layout for email compatibility', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
      expect(html).toContain('<td');
    });

    it('includes viewport meta tag for mobile', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('width=device-width, initial-scale=1.0');
    });

    it('uses inline styles (not external stylesheets)', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('style="');
      expect(html).not.toContain('<link rel="stylesheet"');
    });

    it('uses emoji characters instead of images', () => {
      const html = generateFollowupEmailHtml(baseData);

      expect(html).toContain('🎉'); // Celebration emoji for attended
      expect(html).toContain('📅'); // Calendar emoji
      expect(html).toContain('👤'); // Person emoji
    });

    it('uses wave emoji for no-show header', () => {
      const noShowData = { ...baseData, isNoShow: true };
      const html = generateFollowupEmailHtml(noShowData);

      expect(html).toContain('👋');
    });
  });

  describe('generateFeedbackEmailHtml', () => {
    const baseData = {
      recipientFirstName: 'Laura',
      eventName: 'LiveSchool Office Hours',
      hostName: 'Hannah',
      sessionDate: 'Friday, January 31',
      sessionTime: '10:30 AM',
      timezoneAbbr: 'CT',
      feedbackUrl: 'https://liveschoolhelp.com/feedback/abc123',
    };

    it('generates valid HTML document', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('includes recipient name in greeting', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('Hi Laura');
    });

    it('includes event name', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('LiveSchool Office Hours');
    });

    it('includes session date and time', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('Friday, January 31');
      expect(html).toContain('10:30 AM');
      expect(html).toContain('CT');
    });

    it('includes host name', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('Hannah');
    });

    it('includes feedback CTA button with link', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('Share Feedback');
      expect(html).toContain('https://liveschoolhelp.com/feedback/abc123');
    });

    it('uses purple header for feedback requests', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('#6F71EE');
      expect(html).toContain('How was your session?');
    });

    it('includes speech bubble emoji', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('💬');
    });

    it('includes star emoji for CTA', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('⭐');
    });

    it('uses table-based layout', () => {
      const html = generateFeedbackEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
    });
  });

  describe('generateRecordingEmailHtml', () => {
    const baseData = {
      recipientFirstName: 'Laura',
      eventName: 'LiveSchool Office Hours',
      hostName: 'Hannah',
      sessionDate: 'Friday, January 31',
      sessionTime: '10:30 AM',
      timezoneAbbr: 'CT',
      recordingLink: 'https://fireflies.ai/recording/abc123',
    };

    it('generates valid HTML document', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('includes recipient name in greeting', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('Hi Laura');
    });

    it('includes event name', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('LiveSchool Office Hours');
    });

    it('includes session date and time', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('Friday, January 31');
      expect(html).toContain('10:30 AM');
      expect(html).toContain('CT');
    });

    it('includes recording CTA button with link', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('Watch Recording');
      expect(html).toContain('https://fireflies.ai/recording/abc123');
    });

    it('uses green header for recording notifications', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('#417762');
      expect(html).toContain('Your Recording is Ready!');
    });

    it('includes movie emoji', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('🎬');
    });

    it('includes camera emoji for button', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('🎥');
    });

    it('includes additional resources when provided', () => {
      const dataWithResources = {
        ...baseData,
        deckLink: 'https://docs.google.com/deck',
        sharedLinks: [
          { title: 'Guide', url: 'https://example.com/guide' },
        ],
      };
      const html = generateRecordingEmailHtml(dataWithResources);

      expect(html).toContain('Additional Resources');
      expect(html).toContain('View Slides');
      expect(html).toContain('https://docs.google.com/deck');
      expect(html).toContain('Guide');
      expect(html).toContain('https://example.com/guide');
    });

    it('omits resources section when no additional resources', () => {
      const html = generateRecordingEmailHtml(baseData);

      // Should not contain the visible heading or slides link (comment text is ok)
      expect(html).not.toContain('📎 Additional Resources');
      expect(html).not.toContain('View Slides →');
    });

    it('includes book another session link when URL provided', () => {
      const dataWithBooking = {
        ...baseData,
        bookingPageUrl: 'https://liveschoolhelp.com/book/office-hours',
      };
      const html = generateRecordingEmailHtml(dataWithBooking);

      expect(html).toContain('Want to book another session?');
      expect(html).toContain('Schedule a time');
      expect(html).toContain('https://liveschoolhelp.com/book/office-hours');
    });

    it('omits booking section when no URL', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).not.toContain('Want to book another session?');
    });

    it('uses table-based layout', () => {
      const html = generateRecordingEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
    });
  });

  describe('generateCancellationEmailHtml', () => {
    const baseData = {
      recipientFirstName: 'Laura',
      eventName: 'LiveSchool Office Hours',
      hostName: 'Hannah',
      sessionDate: 'Friday, January 31',
      sessionTime: '10:30 AM',
      timezoneAbbr: 'CT',
      bookingPageUrl: 'https://liveschoolhelp.com/book/office-hours',
    };

    it('generates valid HTML document', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('includes recipient name in greeting', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Hi Laura');
    });

    it('includes event name', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('LiveSchool Office Hours');
    });

    it('includes session date and time with strikethrough', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Friday, January 31');
      expect(html).toContain('10:30 AM');
      expect(html).toContain('CT');
      expect(html).toContain('text-decoration: line-through');
    });

    it('includes host name', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Hannah');
    });

    it('uses gray header for cancellations', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('#667085'); // Gray color
      expect(html).toContain('Booking Cancelled');
    });

    it('includes calendar emoji', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('📅');
    });

    it('includes book another session CTA', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Book Another Session');
      expect(html).toContain('https://liveschoolhelp.com/book/office-hours');
    });

    it('includes custom message when provided', () => {
      const dataWithMessage = {
        ...baseData,
        customMessage: 'Sorry for the short notice. Hope to see you soon!',
      };
      const html = generateCancellationEmailHtml(dataWithMessage);

      expect(html).toContain('Sorry for the short notice. Hope to see you soon!');
    });

    it('uses table-based layout', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('role="presentation"');
      expect(html).toContain('<table');
    });

    it('uses inline styles', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('style="');
      expect(html).not.toContain('<link rel="stylesheet"');
    });

    it('includes footer with LiveSchool branding', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Connect with LiveSchool');
    });

    it('includes reply prompt in footer', () => {
      const html = generateCancellationEmailHtml(baseData);

      expect(html).toContain('Questions? Just reply to this email.');
    });
  });
});
