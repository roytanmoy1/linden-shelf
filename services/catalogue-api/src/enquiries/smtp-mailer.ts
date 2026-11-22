import type { Enquiry, Product } from '@linden-shelf/contracts';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { Config } from '../config.js';
import { ApiError } from '../http/errors.js';
import type { EnquiryMailer } from './enquiry-mailer.js';

export type SmtpDelivery = Pick<SMTPTransport.SentMessageInfo, 'accepted' | 'rejected'>;

export interface SmtpTransport {
  sendMail(message: SendMailOptions): Promise<SmtpDelivery>;
  close(): void;
}

export function createSmtpTransport(
  config: Config,
  factory: (options: SMTPTransport.Options) => SmtpTransport = nodemailer.createTransport,
): SmtpTransport {
  return factory({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    requireTLS: !config.smtpSecure && Boolean(config.smtpUser),
    connectionTimeout: config.smtpConnectionTimeoutMs,
    greetingTimeout: config.smtpGreetingTimeoutMs,
    socketTimeout: config.smtpSocketTimeoutMs,
    ...(config.smtpUser ? { auth: { user: config.smtpUser, pass: config.smtpPassword } } : {}),
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  });
}

export class SmtpEnquiryMailer implements EnquiryMailer {
  constructor(
    private readonly transport: Pick<SmtpTransport, 'sendMail'>,
    private readonly config: Pick<Config, 'mailFrom' | 'salesEmail'>,
  ) {}

  async send(enquiry: Enquiry, product: Product): Promise<void> {
    try {
      const delivery = await this.transport.sendMail({
        from: this.config.mailFrom,
        to: this.config.salesEmail,
        replyTo: enquiry.email,
        envelope: { from: this.config.mailFrom, to: [this.config.salesEmail] },
        subject: `Product enquiry #${product.id}`,
        text: [
          `Product: ${product.id} - ${product.title}`,
          `Category: ${product.category}`,
          `Price (USD): ${product.price.toFixed(2)}`,
          '',
          `Name: ${enquiry.name}`,
          `Email: ${enquiry.email}`,
          `Message: ${enquiry.message || '(not provided)'}`,
        ].join('\n'),
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      const accepted = delivery.accepted.includes(this.config.salesEmail);
      if (!accepted || delivery.rejected.length > 0) throw new ApiError('MAIL_UNAVAILABLE');
    } catch {
      throw new ApiError('MAIL_UNAVAILABLE');
    }
  }
}