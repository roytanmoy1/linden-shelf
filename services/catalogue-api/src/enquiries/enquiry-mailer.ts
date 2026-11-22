import type { Enquiry, Product } from '@linden-shelf/contracts';

export interface EnquiryMailer {
  send(enquiry: Enquiry, product: Product): Promise<void>;
}