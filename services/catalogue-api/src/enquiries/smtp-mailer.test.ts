import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { describe, expect, it, vi } from 'vitest';
import { deferred, enquiry, product } from '../../../../tests/fixtures.js';
import { readConfig } from '../config.js';
import { createSmtpTransport, SmtpEnquiryMailer, type SmtpDelivery, type SmtpTransport } from './smtp-mailer.js';

const accepted: SmtpDelivery = { accepted: ['sales@lindenshelf.test'], rejected: [] };

function setup() {
  const sendMail = vi.fn<SmtpTransport['sendMail']>().mockResolvedValue(accepted);
  const transport = { sendMail, close: vi.fn() };
  return { transport, sendMail, mailer: new SmtpEnquiryMailer(transport, readConfig({})) };
}

describe('SMTP transport configuration', () => {
  it('sets explicit local SMTP deadlines without connecting or verifying', () => {
    const { transport } = setup();
    const factory = vi.fn<(options: SMTPTransport.Options) => SmtpTransport>().mockReturnValue(transport);
    expect(createSmtpTransport(readConfig({}), factory)).toBe(transport);
    expect(factory).toHaveBeenCalledExactlyOnceWith({
      host: '127.0.0.1', port: 1025, secure: false, requireTLS: false,
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
      disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
    });
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it.each(['true', 'false'])('requires TLS for credentials with SMTP_SECURE=%s', (secure) => {
    const { transport } = setup();
    const factory = vi.fn<(options: SMTPTransport.Options) => SmtpTransport>().mockReturnValue(transport);
    const config = readConfig({ SMTP_USER: 'configured-user', SMTP_PASSWORD: 'synthetic-password', SMTP_SECURE: secure });
    createSmtpTransport(config, factory);
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({
      secure: secure === 'true', requireTLS: secure === 'false',
      auth: { user: 'configured-user', pass: 'synthetic-password' },
    }));
  });
});

describe('SMTP enquiry acceptance', () => {
  it('sends fixed addresses, validated Reply-To and text with server-resolved product details', async () => {
    const { mailer, sendMail } = setup();
    await mailer.send(enquiry({ message: 'Is this available?\nThank you.' }), product({ id: 3, title: 'Server known title' }));
    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0]?.[0];
    expect(message).toMatchObject({
      from: 'catalogue@lindenshelf.test', to: 'sales@lindenshelf.test', replyTo: 'alex@example.test',
      envelope: { from: 'catalogue@lindenshelf.test', to: ['sales@lindenshelf.test'] },
      subject: 'Product enquiry #3', disableFileAccess: true, disableUrlAccess: true,
    });
    for (const text of ['3', 'Server known title', '49.50', 'Alex Example', 'alex@example.test', 'Is this available?']) {
      expect(message?.text).toContain(text);
    }
    expect(message).not.toHaveProperty('html');
    expect(message).not.toHaveProperty('attachments');
    expect(message).not.toHaveProperty('raw');
  });

  it('does not place source titles in email headers and supports an absent message', async () => {
    const { mailer, sendMail } = setup();
    await mailer.send(enquiry(), product({ id: 3, title: 'Title\nwith a newline' }));
    const message = sendMail.mock.calls[0]?.[0];
    expect(message?.subject).toBe('Product enquiry #3');
    expect(message?.text).toContain('Message: (not provided)');
  });

  it.each<SmtpDelivery>([
    { accepted: [], rejected: ['sales@lindenshelf.test'] },
    { accepted: [], rejected: [] },
    { accepted: ['other@example.test'], rejected: [] },
    { accepted: ['sales@lindenshelf.test'], rejected: ['sales@lindenshelf.test'] },
  ])('does not treat a resolved transport call as acceptance: %j', async (delivery) => {
    const { mailer, sendMail } = setup();
    sendMail.mockResolvedValue(delivery);
    await expect(mailer.send(enquiry(), product({ id: 3 }))).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE', status: 503 });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it.each(['connection refused', 'timeout', 'private SMTP credentials and response'])('sanitizes %s without retrying', async (failure) => {
    const { mailer, sendMail } = setup();
    sendMail.mockRejectedValue(new Error(failure));
    await expect(mailer.send(enquiry(), product({ id: 3 }))).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE' });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('does not resolve until the configured recipient has been accepted', async () => {
    const { mailer, sendMail } = setup();
    const delivery = deferred<SmtpDelivery>();
    sendMail.mockReturnValue(delivery.promise);
    let completed = false;
    const sending = mailer.send(enquiry(), product({ id: 3 })).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    delivery.resolve(accepted);
    await sending;
    expect(completed).toBe(true);
  });
});